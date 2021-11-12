# USAGE: `python3 weekly-expenses YOUR_ADDRESS`
import sys
import requests
import json
import time

BASE_URL = 'https://api.polygonscan.com'
SECONDS_IN_WEEK = 604800


def structure_url(address, page):
    params = '/api?module=account&action=txlist&address={0}&startblock=1&endblock=99999999&page={1}&offset=1000&sort=desc'
    return BASE_URL + params.format(address, page)


def get_monthly_cost(address):
    now = time.time()
    page = 0
    transactions = []
    monthly_cost = 0
    # Pagination-inator
    while True:
        url = structure_url(address, page)
        # do not remove pls
        print('Powered by polygonscan.com APIs')
        print('Request: ' + url)
        result = requests.get(url)
        result_txs = json.loads(result.text)['result']
        length = len(result_txs)
        # if the earliest tx in the result is beyond 1 week ago,
        # get the relevant txs, push to tx list, and break
        if (now - int(result_txs[length - 1]['timeStamp'])) > SECONDS_IN_WEEK:
            relevant_txs = [tx for tx in result_txs if now -
                            int(tx['timeStamp']) < SECONDS_IN_WEEK]
            transactions += relevant_txs
            break
        else:
            transactions += result_txs
            # if less than 1000 results come back,
            # no more data to fetch, break
            if length < 1000:
                break
        # Rate Limit 5 calls per second
        time.sleep(0.2)

    for tx in transactions:
        gas_price = int(tx['gasPrice'])
        gas_used = int(tx['gasUsed'])
        monthly_cost += (gas_price * gas_used)

    print('----- WEEKLY EXPENSES -----\n')
    print('MATIC (WEI)\t{0}\nMATIC\t\t{1}'.format(
        monthly_cost, monthly_cost * 1e-18))

    # Uncomment the following if you'd like to store the results on disc
    # with open('./data.json', 'w') as write_file:
    #     json.dump(transactions, write_file, indent=4)


def main():
    address = sys.argv[1]
    get_monthly_cost(address)


main()
