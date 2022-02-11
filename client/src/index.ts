import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';

import { getBlockUpdateData } from './retrieveData';
import { abi, bytecode } from '../../build/contracts/Eth2ChainRelay_512_NoStorage.json';

const deployContract = async (
    _account: string,
    _signatureThreshold: number,
    _trustingPeriod: number,
    _finalizedBlockRoot: string,
    _finalizedStateRoot: string,
    _finalizedSlot: number,
    _latestSlot: number,
    _latestSlotWithValidatorSetChange: number,
    _url = 'http://localhost:8545',
): Promise<string> => {
    const web3 = new Web3(_url);

    const relayContract = new web3.eth.Contract(abi as AbiItem[]);
    return new Promise<string>((resolve, reject) => {
        relayContract.deploy({
            data: bytecode,
            arguments: [
                _signatureThreshold,
                _trustingPeriod,
                web3.utils.numberToHex(_finalizedBlockRoot),
                web3.utils.numberToHex(_finalizedStateRoot),
                _finalizedSlot,
                _latestSlot,
                _latestSlotWithValidatorSetChange,
            ],
        }).send({
            from: _account,
            gas: 8000000,
        }).then((receipt) => {
            resolve(receipt.options.address);
        }).catch((err) => {
            reject(err);
        });
    });
};

const deployContractAtPeriod = async (
    _account: string,
    _syncCommitteePeriod: number,
    _signatureThreshold: number,
    _trustingPeriod: number,
    _sourceUrl = 'http://localhost:9596',
    _targetUrl = 'http://localhost:8545',
): Promise<string> => {
    const updateData = await getBlockUpdateData(_syncCommitteePeriod, _sourceUrl);

    return (deployContract(
        _account,
        _signatureThreshold,
        _trustingPeriod,
        updateData.finalizedBlockRoot,
        updateData.finalizedStateRoot,
        updateData.finalizedSlot,
        updateData.latestSlot,
        updateData.latestSlot-10000, // ???
        _targetUrl,
    ));
};

const updateContract = async (
    _relayContractAddress: string,
    _syncCommitteePeriod: number,
    _account: string,
    _sourceUrl = 'http://localhost:9596',
    _targetUrl = 'http://localhost:8545',
): Promise<string> => {
    const web3 = new Web3(_targetUrl);
    const relayContract = new web3.eth.Contract(abi as AbiItem[], _relayContractAddress);

    const updateData = await getBlockUpdateData(_syncCommitteePeriod, _sourceUrl);

    return new Promise<string>((resolve, reject) => {
        relayContract.methods.submitUpdate(updateData).send({ from: _account }).then((receipt: TransactionReceipt) => {
            resolve(receipt.transactionHash);
        }).catch((err: Error) => {
            reject(err);
        });
    });
};

const targetUrl = 'http://localhost:8555';
const sourceUrl = 'http://localhost:9596';
const web3 = new Web3(targetUrl);
let account: string;
let address: string;
let syncCommitteeEpoch = 10;
web3.eth.getAccounts().then((_accounts) => {
    [account] = _accounts;
    console.log('account: ', account);
    return deployContractAtPeriod(
        account,
        syncCommitteeEpoch++,
        170,
        0,
        sourceUrl,
        targetUrl,
    );
}).then((_address) => {
    address = _address;
    console.log('relay contract address: ', address);
    return updateContract(
        address,
        syncCommitteeEpoch++,
        account,
        sourceUrl,
        targetUrl,
    );
}).then((_transactionHash) => {
    console.log('txHash: ', _transactionHash);
    return updateContract(
        address,
        syncCommitteeEpoch++,
        account,
        sourceUrl,
        targetUrl,
    );
}).then((_transactionHash) => {
    console.log('txHash: ', _transactionHash);
});
