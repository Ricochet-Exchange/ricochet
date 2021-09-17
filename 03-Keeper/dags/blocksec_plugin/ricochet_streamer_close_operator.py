from airflow.models.baseoperator import BaseOperator
from airflow.utils.decorators import apply_defaults
from blocksec_plugin.web3_hook import Web3Hook
from blocksec_plugin.ethereum_wallet_hook import EthereumWalletHook
from blocksec_plugin.abis import RICOCHET_ABI
import requests, json
from time import sleep


class RicochetStreamerCloseOperator(BaseOperator):
    """
    Closes a streamers stream using `closeStream`
    """
    template_fields = ['streamer_address', 'exchange_address', 'nonce']

    @apply_defaults
    def __init__(self,
                 streamer_address=None,
                 exchange_address=None,
                 nonce=None,
                 web3_conn_id='web3_default',
                 ethereum_wallet=None,
                 gas=1200000,
                 gas_multiplier=1,
                 *args,
                 **kwargs):
        super().__init__(*args, **kwargs)
        self.web3_conn_id = web3_conn_id
        self.exchange_address = exchange_address
        self.streamer_address = streamer_address
        self.nonce = nonce
        self.gas = gas
        self.gas_multiplier = gas_multiplier
        self.web3 = Web3Hook(web3_conn_id=self.web3_conn_id).http_client
        self.wallet = EthereumWalletHook(ethereum_wallet=ethereum_wallet)


    def execute(self, context):
        # Create the contract factory
        print("Processing closeStream for Ricochet at {0} for {1} by {2}".format(
            self.exchange_address, self.streamer_address, self.wallet.public_address
        ))
        contract = self.web3.eth.contract(self.exchange_address, abi=RICOCHET_ABI)
        # Form the signed transaction
        withdraw_txn = contract.functions.closeStream(self.streamer_address)\
                                         .buildTransaction(dict(
                                           nonce=int(self.nonce),
                                           gasPrice = self.web3.eth.gasPrice * self.gas_multiplier,
                                           gas = self.gas
                                          ))
        signed_txn = self.web3.eth.account.signTransaction(withdraw_txn, self.wallet.private_key)
        # Send the transaction
        transaction_hash = self.web3.eth.sendRawTransaction(signed_txn.rawTransaction)
        print("Sent closeStream()... transaction hash: {0}".format(transaction_hash.hex()))
        return str(transaction_hash.hex()) # Return for use with EthereumTransactionConfirmationSensor
