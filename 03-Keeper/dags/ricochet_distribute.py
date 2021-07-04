"""
Tellor Contract Poll

- Every 5 minutes, get the logs for Tellor
- Parse logs and insert them into the data warehouse

"""
from airflow import DAG
from airflow.models import Variable
from datetime import datetime, timedelta
from blocksec_plugin.web3_hook import Web3Hook
from airflow.operators.bash_operator import BashOperator
from airflow.operators.python_operator import PythonOperator
from blocksec_plugin.ethereum_transaction_confirmation_sensor import EthereumTransactionConfirmationSensor
from blocksec_plugin.tellor_oracle_operator import TellorOracleOperator
from blocksec_plugin.ricochet_distribute_operator import RicochetDistributeOperator
from abi.tellor import TELLOR_ABI
from json import loads

WALLET_ADDRESS = "0xe07c9696e00f23Fc7bAE76d037A115bfF33E28be"

default_args = {
    "owner": "ricochet",
    "depends_on_past": False,
    "start_date": datetime(2020, 3, 29),
    "email": ["mike@mikeghen.com"],
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 0,
    "retry_delay": timedelta(minutes=1)
}


dag = DAG("ricochet_distribute",
          max_active_runs=1,
          catchup=False,
          default_args=default_args,
          schedule_interval="*/5 * * * *")


def check_price(**context):
    """
    Check the price of the assets to use for updating the oracle
    """
    # TODO: This only works on Rinkeby with TellorPlayground
    return 1050000

done = BashOperator(
    task_id='done',
    bash_command='date',
    dag=dag,
)
price_check = PythonOperator(
    task_id="price_check",
    provide_context=True,
    python_callable=check_price,
    dag=dag
)

oracle_update = TellorOracleOperator(
    task_id="oracle_update",
    web3_conn_id="infura",
    ethereum_wallet=WALLET_ADDRESS,
    price='{{task_instance.xcom_pull(task_ids="price_check")}}',
    request_id=1,
    gas_multiplier=1,
    gas=250000,
    dag=dag,
)

confirm_oracle_update = EthereumTransactionConfirmationSensor(
    task_id="confirm_oracle_update",
    web3_conn_id="infura",
    transaction_hash="{{task_instance.xcom_pull(task_ids='oracle_update')}}",
    confirmations=1,
    poke_interval=20,
    dag=dag
)

distribute = RicochetDistributeOperator(
    task_id="distribute",
    web3_conn_id="infura",
    ethereum_wallet=WALLET_ADDRESS,
    dag=dag
)

confirm_distribute = EthereumTransactionConfirmationSensor(
    task_id="confirm_distribute",
    web3_conn_id="infura",
    transaction_hash="{{task_instance.xcom_pull(task_ids='distribute')}}",
    confirmations=1,
    poke_interval=20,
    dag=dag
)

done << confirm_distribute << distribute << confirm_oracle_update << oracle_update << price_check
