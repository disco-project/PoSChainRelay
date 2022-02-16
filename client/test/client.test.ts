import { describe, before } from 'mocha';
import { expect } from 'chai';
import Web3 from 'web3';

import { logger } from '../src/utils/logger';
import { deployContractAtPeriod, updateContract } from '../src/index';

describe('Deploy and update relay', () => {
    const targetUrl = 'http://localhost:8555';
    const sourceUrl = 'http://localhost:9596';
    let syncCommitteePeriod = 1;
    let relayContractAddress: string;
    let web3: Web3;
    let account: string;

    before(async () => {
        logger.setSettings({ minLevel: 'info', name: 'client test setup' });

        web3 = new Web3(targetUrl);
        [account] = await web3.eth.getAccounts();
        expect(account).to.be.not.undefined;
    });

    it('should deploy the relay contract', async () => {
        logger.setSettings({ minLevel: 'info', name: 'deploy relay contract' });

        relayContractAddress = await deployContractAtPeriod(
            account,
            syncCommitteePeriod++,
            170,
            0,
            sourceUrl,
            targetUrl,
        );
        expect(relayContractAddress).to.be.not.undefined;
    });

    const updateRelayContract = (i: number) => {
        it(`should update relay contract with new sync committee period, ${i}. iteration`, async () => {
            logger.setSettings({ minLevel: 'info', name: `update relay, ${i} iteration` });

            const txHash = await updateContract(
                relayContractAddress,
                syncCommitteePeriod++,
                account,
                sourceUrl,
                targetUrl,
            );
            expect(txHash).to.be.not.undefined;
            logger.info(`${i}. update txHash: ${txHash}`);
        });
    };

    describe('multiple updates', () => {
        for (let i = 1; i <= 5; i++) {
            updateRelayContract(i);
        }
    });
});
