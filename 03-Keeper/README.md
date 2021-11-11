# Ricochet Keeper
This repository contains [Apache Airflow DAGs](https://airflow.apache.org/docs/apache-airflow/stable/concepts/dags.html) for executing keeper operations for Ricochet Exchange.

# Usage
You will need to run this using Docker and Docker Compose.
```
docker-compose up
```
:information_source: This will take a while the first time you do it
:warning: You may need to increase your Docker memory to > 4GB, default is 2GB

# Setup
After starting up Airflow, navigate to `Admin > Connections` and setup the following:
* A `HTTP` connection called `infura` with the connection's `Extra` as:
```
{
"http_endpoint_uri": "YOUR_INFURA_HTTP_URI",
"wss_endpoint_uri": "YOUR_INFURA_WSS_URI"
}
```
* Another `HTTP` connection called `YOUR_DISTRIBUTOR_WALLET_ADDRESS`, that is, name this connection as the address you plan to use for executing `distribute` transactions
  * Set the `Login` to `YOUR_DISTRIBUTOR_WALLET_ADDRESS`
  * Set the `Password` to `YOUR_PRIVATE_KEY` (private key is needed to execute txns automatically)

Lastly, navigate to `Admin > Variables` and add the following:
* `distributor-address` - the address used for executing `distribute` transactions (i.e. `YOUR_DISTRIBUTOR_WALLET_ADDRESS`)
* `ricochet-exchange-addresses` - add these addresses to value field:
```
[ "0xeb367F6a0DDd531666D778BC096d212a235a6f78", "0x27C7D067A0C143990EC6ed2772E7136Cfcfaecd6", "0x5786D3754443C0D3D1DdEA5bB550ccc476FdF11D", "0xe0A0ec8dee2f73943A6b731a2e11484916f45D44", "0x8082Ab2f4E220dAd92689F3682F3e7a42b206B42", "0x3941e2E89f7047E0AC7B9CcE18fBe90927a32100", "0x71f649EB05AA48cF8d92328D1C486B7d9fDbfF6b", "0x47de4Fd666373Ca4A793e2E0e7F995Ea7D3c9A29", "0x94e5b18309066dd1E5aE97628afC9d4d7EB58161", "0xdc19ed26aD3a544e729B72B50b518a231cBAD9Ab", "0xC89583Fa7B84d81FE54c1339ce3fEb10De8B4C96", "0x9BEf427fa1fF5269b824eeD9415F7622b81244f5", "0x0A70Fbb45bc8c70fb94d8678b92686Bb69dEA3c3", "0x93D2d0812C9856141B080e9Ef6E97c7A7b342d7F", "0xE093D8A4269CE5C91cD9389A0646bAdAB2c8D9A3", "0xA152715dF800dB5926598917A6eF3702308bcB7e", "0x250efbB94De68dD165bD6c98e804E08153Eb91c6", "0x98d463A3F29F259E67176482eB15107F364c7E18" ]
```

# Run 
Run the keeper using Docker Compose
```
docker-compose up
```
Airflow runs on port 80 so navigate to http://localhost to access the UI. Once things have booted up, log in with username `airflow` and password  `airflow`.

## Run as daemon
Use:
```
docker-compose up -d
```
