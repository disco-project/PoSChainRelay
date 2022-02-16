import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { TransactionReceipt } from 'web3-core';

import { getBlockUpdateData } from './retrieveData';
import { abi, bytecode } from '../../build/contracts/Eth2ChainRelay_512_NoStorage.json';

export const deployContract = async (
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

export const deployContractAtPeriod = async (
    _account: string,
    _syncCommitteePeriod: number,
    _signatureThreshold: number,
    _trustingPeriod: number,
    _sourceUrl = 'http://localhost:9596',
    _targetUrl = 'http://localhost:8545',
): Promise<string> => {
    const updateData = await getBlockUpdateData(_syncCommitteePeriod, _sourceUrl);

    return deployContract(
        _account,
        _signatureThreshold,
        _trustingPeriod,
        updateData.finalizedBlockRoot,
        updateData.finalizedStateRoot,
        updateData.finalizedSlot,
        updateData.latestSlot,
        updateData.latestSlot - 10000, // ???
        _targetUrl,
    );
};

export const updateContract = async (
    _relayContractAddress: string,
    _syncCommitteePeriod: number,
    _account: string,
    _sourceUrl = 'http://localhost:9596',
    _targetUrl = 'http://localhost:8545',
): Promise<string> => {
    const web3 = new Web3(_targetUrl);
    const relayContract = new web3.eth.Contract(abi as AbiItem[], _relayContractAddress);

    const updateData = await getBlockUpdateData(_syncCommitteePeriod, _sourceUrl);

    const receipt: TransactionReceipt = await relayContract.methods.submitUpdate(updateData).send({ from: _account });
    return receipt.transactionHash;
};
