import { describe, before } from 'mocha';
import { expect, assert } from 'chai';
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
        expect(account).to.exist;
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
        expect(relayContractAddress).to.exist;
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
            expect(txHash).to.exist;
            logger.info(`${i}. update txHash: ${txHash}`);
        });
    };

    describe('multiple updates', () => {
        for (let i = 1; i <= 3; i++) {
            updateRelayContract(i);
        }

        it('should reject update skipping subsequennt period', async () => {
            logger.setSettings({ minLevel: 'info', name: 'reject update' });

            return updateContract(
                relayContractAddress,
                syncCommitteePeriod + 1,
                account,
                sourceUrl,
                targetUrl,
            ).then((txHash) => {
                assert.fail(`transaction should fail, but was okay at tx: ${txHash}`);
            }).catch((err: Error) => {
                expect(err.message).to.have.string('merkle proof for next sync committee not valid');
                logger.info(`transaction failed as expected: ${err.message}`);
            });
        });
    });
});
