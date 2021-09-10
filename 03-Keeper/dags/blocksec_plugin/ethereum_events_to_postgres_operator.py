from airflow.models.baseoperator import BaseOperator
from airflow.utils.decorators import apply_defaults
from airflow.hooks.postgres_hook import PostgresHook
from blocksec_plugin.web3_hook import Web3Hook
from datetime import datetime
from tempfile import NamedTemporaryFile
from copy import deepcopy
from functools import partial
from eth_abi.exceptions import DecodingError
from eth_utils import event_abi_to_log_topic
from web3._utils.events import get_event_data
from json import dumps
import re


class EthereumEventstoPostgresOperator(BaseOperator):
    """
    Get the event logs for a Ethereum contract within a range of blocks
    """
    template_fields = ['from_block', 'to_block']

    @apply_defaults
    def __init__(self,
                 web3_conn_id='web3_default',
                 postgres_conn_id='postgres_default',
                 postgres_table='ethereum_events',
                 contract_address=None,
                 abi_json=None,
                 event_name=None,
                 from_block=None,
                 to_block=None,
                 *args,
                 **kwargs):
        super().__init__(*args, **kwargs)
        self.postgres_conn_id = postgres_conn_id
        self.postgres_table = postgres_table
        self.web3_conn_id = web3_conn_id
        self.contract_address = contract_address
        self.abi_json = abi_json
        self.event_name = event_name
        self.from_block = from_block
        self.to_block = to_block
        self.web3 = Web3Hook(web3_conn_id=self.web3_conn_id).http_client

    def execute(self, context):
        to_block = int(self.to_block)
        while int(self.from_block) < to_block:
            self.to_block = int(self.from_block) + 10000 - 1
            print("Scanning", self.from_block, self.to_block)
            events = self._load_contract_events()
            self.from_block = self.to_block
            postgres = PostgresHook(postgres_conn_id=self.postgres_conn_id)
            # conn = postgres.get_conn()
            # cursor = conn.cursor()
            # cursor.execute("""
            # INSERT INTO ethereum_events(args,event,log_index,transaction_index,transaction_hash,address,block_hash,block_number)
            # VALUES ('{0}','{1}',{2},{3},'{4}','{5}','{6}',{7})
            # """.format(args,event["event"],event["logIndex"],\
            #             event["transactionIndex"],event["transactionHash"],\
            #             event["address"],event["blockHash"],event["blockNumber"]))
            with NamedTemporaryFile(mode='r+') as file:
                print(file.name)
                for event in events:
                    print(event["args"])
                    try:
                        args = dumps(dict(event["args"]))
                    except TypeError:
                        args = {}
                        for key, value in event["args"].items():
                            pattern = re.compile('[\W_]+', re.UNICODE)
                            if isinstance(value, bytes):
                                args[key] = pattern.sub('', value.hex())
                            elif isinstance(value, str):
                                args[key] = pattern.sub('',value.replace("\\","\\\\"))
                            else:
                                args[key] = value

                        args = dumps(args)
                    file.write("{0}\t{1}\t{2}\t{3}\t{4}\t{5}\t{6}\t{7}\t{8}\n"\
                        .format(args,event["event"],event["logIndex"],\
                                event["transactionIndex"],event["transactionHash"].hex(),\
                                event["address"],event["blockHash"].hex(),event["blockNumber"], datetime.now()))
                file.seek(0)
                result = postgres.bulk_load('ethereum_events(args,event,log_index,transaction_index,transaction_hash,address,block_hash,block_number,created_at)', file.name)


    def _load_contract_events(self):
        decoders = self._get_log_decoders(self.abi_json)
        print("Filtering Eth logs")
        logs = self.web3.eth.getLogs({
            'address': self.contract_address,
            'fromBlock': int(self.from_block),
            'toBlock': int(self.to_block)
        })
        print("Getting all events from filter", self.from_block, self.to_block)
        #event_logs = event_filter.get_all_entries()
        return self._decode_logs(logs, decoders)


    def _get_log_decoders(self, contract_abi):
        """
        Source: banteg/tellor
        """
        decoders = {
            event_abi_to_log_topic(abi): partial(get_event_data, self.web3.codec, abi)
            for abi in contract_abi if abi['type'] == 'event'
        }
        # fix for byte nonce in events
        # nonce_string_abi = next(x for x in contract_abi if x.get('name') == 'NonceSubmitted')
        # nonce_string_topic = event_abi_to_log_topic(nonce_string_abi)
        # nonce_bytes_abi = deepcopy(nonce_string_abi)
        # nonce_bytes_abi['inputs'][1]['type'] = 'bytes'
        # decoders[nonce_string_topic] = partial(self._decode_log_with_fallback, [nonce_string_abi, nonce_bytes_abi])
        return decoders


    def _decode_log_with_fallback(self, abis_to_try, log):
        """
        Source: banteg/tellor
        """
        for abi in abis_to_try:
            try:
                log_with_replaced_topic = deepcopy(log)
                log_with_replaced_topic['topics'][0] = event_abi_to_log_topic(abi)
                return get_event_data(self.web3.codec, abi, log_with_replaced_topic)
            except DecodingError:
                print('trying fallback log decoder')
        raise DecodingError('could not decode log')


    def _decode_logs(self, logs, decoders):
        """
        Source: banteg/tellor
        """
        result = []
        for log in logs:
            topic = log['topics'][0]
            if topic in decoders:
                try:
                    decoded = decoders[topic](log)
                    result.append(decoded)
                except DecodingError as e:
                    print('could not decode log')
                    print(log)
                    print(e)
        return result
