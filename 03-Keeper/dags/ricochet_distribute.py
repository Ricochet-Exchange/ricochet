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
from blocksec_plugin.abis import TELLOR_ABI
from json import loads
import requests

DISTRIBUTOR_WALLET_ADDRESS = Variable.get("distributor-address", "0xe07c9696e00f23Fc7bAE76d037A115bfF33E28be")
REPORTER_WALLET_ADDRESS = Variable.get("reporter-address", "0xe07c9696e00f23Fc7bAE76d037A115bfF33E28be")
OLD_TELLOR_CONTRACT_ADDRESS = Variable.get("old-tellor-address", "0xC79255821DA1edf8E1a8870ED5cED9099bf2eAAA")
TELLOR_CONTRACT_ADDRESS = Variable.get("tellor-address", "0xACC2d27400029904919ea54fFc0b18Bf07C57875")
EXCHANGE_ADDRESSES = Variable.get("ricochet-exchange-addresses", deserialize_json=True)

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
          schedule_interval="0 * * * *")


def check_price(**context):
    """
    Check the price of the assets to use for updating the oracle
    """
    url = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    response = requests.get(url)
    result = response.json()
    # Raise the price by 20 basis points and scale for Tellor
    price = int(result["ethereum"]["usd"] * 1.005 * 1000000)
    return price

web3 = Web3Hook(web3_conn_id='infura').http_client
current_nonce = web3.eth.getTransactionCount(DISTRIBUTOR_WALLET_ADDRESS)

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

oracle_update_old = TellorOracleOperator(
    task_id="oracle_update_old",
    web3_conn_id="infura",
    ethereum_wallet=REPORTER_WALLET_ADDRESS,
    contract_address=OLD_TELLOR_CONTRACT_ADDRESS,
    price='{{task_instance.xcom_pull(task_ids="price_check")}}',
    request_id=1,
    gas_multiplier=10,
    gas=250000,
    dag=dag,
)

confirm_oracle_update_old = EthereumTransactionConfirmationSensor(
    task_id="confirm_oracle_update_old",
    web3_conn_id="infura",
    transaction_hash="{{task_instance.xcom_pull(task_ids='oracle_update_old')}}",
    confirmations=1,
    poke_interval=5,
    dag=dag
)

oracle_update = TellorOracleOperator(
    task_id="oracle_update",
    web3_conn_id="infura",
    ethereum_wallet=REPORTER_WALLET_ADDRESS,
    contract_address=TELLOR_CONTRACT_ADDRESS,
    price='{{task_instance.xcom_pull(task_ids="price_check")}}',
    request_id=1,
    gas_multiplier=10,
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

for nonce_offset, exchange_address in enumerate(EXCHANGE_ADDRESSES):
    distribute = RicochetDistributeOperator(
        task_id="distribute_" + exchange_address,
        web3_conn_id="infura",
        ethereum_wallet=DISTRIBUTOR_WALLET_ADDRESS,
        gas_multiplier=10,
        contract_address=exchange_address,
        nonce=current_nonce + nonce_offset,
        dag=dag
    )

    confirm_distribute = EthereumTransactionConfirmationSensor(
        task_id="confirm_distribute_" + exchange_address,
        web3_conn_id="infura",
        transaction_hash="{{task_instance.xcom_pull(task_ids='distribute_" + exchange_address + "')}}",
        confirmations=1,
        poke_interval=5,
        dag=dag
    )

    done << confirm_distribute << distribute << \
            confirm_oracle_update << oracle_update <<confirm_oracle_update_old << oracle_update_old << price_check
