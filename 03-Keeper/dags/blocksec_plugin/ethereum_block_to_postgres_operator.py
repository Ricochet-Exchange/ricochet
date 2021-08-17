from airflow.models.baseoperator import BaseOperator
from airflow.utils.decorators import apply_defaults
from airflow.hooks.postgres_hook import PostgresHook
from blocksec_plugin.web3_hook import Web3Hook
from datetime import datetime, timedelta
from tempfile import NamedTemporaryFile
from web3.middleware import geth_poa_middleware

class EthereumBlocktoPostgresOperator(BaseOperator):
    """
    Checks the current Ethereum block height and save it to a postgres
    database table
    """

    @apply_defaults
    def __init__(self,
                 postgres_conn_id='postgres_default',
                 postgres_table='ethereum_blocks',
                 web3_conn_id='web3_default',
                 *args,
                 **kwargs):
        super().__init__(*args, **kwargs)
        self.postgres_conn_id = postgres_conn_id
        self.postgres_table = postgres_table
        self.web3_conn_id = web3_conn_id

    def execute(self, context):
        """
        Check the block height on Ethereum and save it to postgres
        """
        web3 = Web3Hook(web3_conn_id=self.web3_conn_id).http_client
        web3.middleware_onion.inject(geth_poa_middleware, layer=0)
        print("Web3", web3)
        block_height = web3.eth.blockNumber
        print(block_height)
        block_data = web3.eth.getBlock(block_height)
        print(block_data)
        with NamedTemporaryFile(mode='r+') as file:
            file.write("{0}\t{1}\n".format(block_height, datetime.fromtimestamp(block_data.timestamp)))
            file.seek(0)
            postgres = PostgresHook(postgres_conn_id=self.postgres_conn_id)
            print(file.name)
            result = postgres.bulk_load('ethereum_blocks(block_height,mined_at)', file.name)
            print(result)
            return block_data.number
