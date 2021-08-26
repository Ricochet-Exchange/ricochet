from airflow.utils.decorators import apply_defaults
from airflow.sensors.base_sensor_operator import BaseSensorOperator
from blocksec_plugin.web3_hook import Web3Hook
from blocksec_plugin.ethereum_wallet_hook import EthereumWalletHook
from web3.exceptions import TransactionNotFound

class EthereumTransactionConfirmationSensor(BaseSensorOperator):

    template_fields = ['transaction_hash']

    @apply_defaults
    def __init__(
            self,
            transaction_hash,
            confirmations=1,
            web3_conn_id='web3_default',
            *args, **kwargs):
        super(EthereumTransactionConfirmationSensor, self).__init__(*args, **kwargs)
        self.transaction_hash = transaction_hash
        self.confirmations = confirmations
        self.web3_conn_id = web3_conn_id

    def poke(self, context):
        web3 = Web3Hook(web3_conn_id=self.web3_conn_id).http_client
        try:
            receipt = web3.eth.get_transaction_receipt(self.transaction_hash)
            confirmations = web3.eth.blockNumber - receipt.blockNumber
        except TypeError: # Transaction has no block number
            confirmations = 0
        except TransactionNotFound:
            confirmations = 0
        print("Transaction {0} has {1} confirmations".format(self.transaction_hash, confirmations))
        if confirmations >= self.confirmations:
            receipt = web3.eth.get_transaction_receipt(self.transaction_hash)
            print("{0} has status {1}".format(self.transaction_hash,receipt['status']))
            if receipt['status'] == 1:
                return True
            else:
                # Fail if the transaction failed
                raise Exception('Transaction Failed')
        else:
            return False
