"""
Ricochet Stream Watch

- Checks all the streamers and closes streams that are close to running out

"""
from airflow import DAG
from airflow.models import Variable
from datetime import datetime, timedelta
from blocksec_plugin.web3_hook import Web3Hook
from airflow.operators.bash_operator import BashOperator
from airflow.operators.python_operator import PythonOperator
from blocksec_plugin.ethereum_transaction_confirmation_sensor import EthereumTransactionConfirmationSensor
from blocksec_plugin.ricochet_streamer_list_operator import RicochetStreamerListOperator
from blocksec_plugin.abis import RICOCHET_ABI, ERC20_ABI
from json import loads
import requests

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


dag = DAG("ricochet_stream_watch",
          max_active_runs=1,
          catchup=False,
          default_args=default_args,
          schedule_interval="50 * * * *")


done = BashOperator(
    task_id='done',
    bash_command='date',
    dag=dag,
)


def review_streamers_and_trigger_closures(exchange_address, **context):
    """
    Trigger payouts for miners
    """
    execution_date = context['execution_date'].isoformat()
    # TODO: Payouts
    streamers = context['task_instance'].xcom_pull(task_ids='list_streamers_'+exchange_address)
    web3 = Web3Hook(web3_conn_id='infura').http_client
    c = Client(None, None)
    index = 0
    current_nonce = web3.eth.getTransactionCount(POOL_WALLET_ADDRESS)
    for index, streamer in enumerate(streamers):

        # Check if the streamers balance is less that 8 hours of streamer
        ricochet = web3.eth.contract(address=exchange_address, abi=RICOCHET_ABI)
        input_token = ricochet.functions.getInputToken()
        input_token = web3.eth.contract(address=input_token, abi=ERC20_ABI)
        balance = input_token.functions.balanceOf(streamer)
        rate = ricochet.functions.getStreamRate(streamer)
        is_closable = balance > rate * 60 * 60 * 8 # balance is greater than 8 hours of streaming

        # Trigger ricochet_stream_closer is the stream is closable
        if is_closable:
            try:
                conf = {
                    "streamer_address": Web3.toChecksumAddress(streamer),
                    "exchange_address": exchange_address,
                    "nonce": current_nonce + index
                }
            except ValueError:
                print("Fail", miner_payout)
                continue

        index += 1
        result = c.trigger_dag(dag_id='ricochet_stream_closure',
                      run_id=streamer + execution_date,
                      conf=conf)
        print("Trigged: ", result, conf)
        sleep(2)
    return


for exchange_address in EXCHANGE_ADDRESSES:

    list_streamers = RicochetStreamerListOperator(
        streamers_file_path=exchange_address + "_streamers_state.json",
        web3_conn_id='infura',
        contract_address=exchange_address,
        task_id='list_streamers_'+exchange_address,
        dag=dag
    )

    closures = PythonOperator(
        task_id='closures_' + exchange_address,
        provide_context=True,
        python_callable=review_streamers_and_trigger_closures,
        op_args={'exchange_address': exchange_address},
        dag=dag
    )


    done << closures << list_streamers
