"""
Ricochet Stream Closure

- This DAG is triggered by

"""
from airflow import DAG
from airflow.models import Variable
from datetime import datetime, timedelta
from blocksec_plugin.web3_hook import Web3Hook
from airflow.operators.bash_operator import BashOperator
from airflow.operators.python_operator import PythonOperator
from blocksec_plugin.ethereum_transaction_confirmation_sensor import EthereumTransactionConfirmationSensor
from blocksec_plugin.ricochet_streamer_close_operator import RicochetStreamerCloseOperator
from blocksec_plugin.abis import RICOCHET_ABI
from json import loads
import requests

CLOSER_WALLET_ADDRESS = Variable.get("closer-address", "0xe07c9696e00f23Fc7bAE76d037A115bfF33E28be")

default_args = {
    "owner": "ricochet",
    "depends_on_past": False,
    "start_date": datetime(2020, 3, 29),
    "email": ["mike@mikeghen.com"],
    "email_on_failure": True,
    "email_on_retry": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5)
}


dag = DAG("ricochet_stream_closure",
          max_active_runs=1,
          catchup=False,
          default_args=default_args,
          schedule_interval=None)


done = BashOperator(
    task_id='done',
    bash_command='date',
    dag=dag,
)

close_stream = RicochetStreamerCloseOperator(
    task_id="close_stream",
    web3_conn_id="infura",    # Set in Aiflow Connections UI
    ethereum_wallet=CLOSER_WALLET_ADDRESS, # Set in Airflow Connections UI
    streamer_address='{{ dag_run.conf["streamer_address"] }}',
    exchange_address='{{ dag_run.conf["exchange_address"] }}',
    nonce='{{ dag_run.conf["nonce"] }}',
    gas_multiplier=10,
    dag=dag,
)

confirm_close = EthereumTransactionConfirmationSensor(
    task_id="confirm_send",
    web3_conn_id="infura",
    transaction_hash="{{task_instance.xcom_pull(task_ids='close_stream')}}",
    confirmations=1,
    poke_interval=20,
    timeout=60 * 3,
    dag=dag
)


done << confirm_close << close_stream
