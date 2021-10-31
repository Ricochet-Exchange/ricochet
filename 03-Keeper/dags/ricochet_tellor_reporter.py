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
from blocksec_plugin.coingecko_price_operator import CoinGeckoPriceOperator
from blocksec_plugin.abis import TELLOR_ABI
from json import loads
import requests

REPORTER_WALLET_ADDRESS = Variable.get("reporter-address", "0xe07c9696e00f23Fc7bAE76d037A115bfF33E28be")
TELLOR_CONTRACT_ADDRESS = Variable.get("tellor-address", "0xACC2d27400029904919ea54fFc0b18Bf07C57875")
ASSETS = Variable.get("tellor-assets", {"ethereum": 1, "wrapped-btc": 60}, deserialize_json=True)

default_args = {
    "owner": "ricochet",
    "depends_on_past": False,
    "start_date": datetime(2020, 3, 29),
    "email": ["mike@mikeghen.com"],
    "email_on_failure": True,
    "email_on_retry": False,
    "retries": 0,
    "retry_delay": timedelta(minutes=1)
}


dag = DAG("ricochet_tellor_reporter",
          max_active_runs=1,
          catchup=False,
          default_args=default_args,
          schedule_interval="55 * * * *")


done = BashOperator(
    task_id='done',
    bash_command='date',
    dag=dag,
)

web3 = Web3Hook(web3_conn_id='infura').http_client
current_nonce = web3.eth.getTransactionCount(REPORTER_WALLET_ADDRESS)
nonce_offset = 0

for asset_id, request_id in ASSETS.items():

    price_check = CoinGeckoPriceOperator(
        task_id="price_check_"+asset_id,
        asset_id=asset_id,
        dag=dag
    )

    oracle_update = TellorOracleOperator(
        task_id="oracle_update_" + asset_id,
        web3_conn_id="infura",
        ethereum_wallet=REPORTER_WALLET_ADDRESS,
        contract_address=TELLOR_CONTRACT_ADDRESS,
        price="{{task_instance.xcom_pull(task_ids='price_check_"+asset_id+"', key='return_value')}}",
        request_id=request_id,
        nonce=current_nonce + nonce_offset,
        gas_multiplier=2,
        gas=250000,
        dag=dag,
    )

    confirm_oracle_update = EthereumTransactionConfirmationSensor(
        task_id="confirm_oracle_update_" + asset_id,
        web3_conn_id="infura",
        transaction_hash="{{task_instance.xcom_pull(task_ids='oracle_update_"+asset_id+"', key='return_value')}}",
        confirmations=1,
        poke_interval=5,
        timeout=60 * 3,
        dag=dag
    )

    done << confirm_oracle_update << oracle_update << price_check
    nonce_offset += 1
