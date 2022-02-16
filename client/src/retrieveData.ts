import { getClient } from '@chainsafe/lodestar-api';
import { config } from '@chainsafe/lodestar-config/default';
import { createIBeaconConfig, IBeaconConfig } from '@chainsafe/lodestar-config';
import { toHexString } from '@chainsafe/ssz';
import { DOMAIN_SYNC_COMMITTEE } from '@chainsafe/lodestar-params';
import { ssz } from '@chainsafe/lodestar-types';
import { isValidMerkleBranch } from '@chainsafe/lodestar-light-client/lib/utils/verifyMerkleBranch';
import { computeSyncPeriodAtEpoch } from '@chainsafe/lodestar-light-client/lib/utils/clock';

import { ChainRelayUpdate } from './types';
import { logger } from './utils/logger';

const FINALIZED_ROOT_INDEX = 105;
// const CURRENT_SYNC_COMMITTEE_INDEX = 54;
const NEXT_SYNC_COMMITTEE_INDEX = 55;
const SLOT_INDEX = 8;
const STATE_ROOT_INDEX = 11;

const fromGindex = (gindex: number): [number, number] => {
    const depth = Math.floor(Math.log2(gindex));
    const firstIndex = 2 ** depth;
    return [depth, gindex % firstIndex];
};

export const getBlockUpdateData = async (
    _syncCommitteePeriod: number,
    _url = 'http://localhost:9596',
): Promise<ChainRelayUpdate> => {
    const api = getClient(config, { baseUrl: _url });

    const committeeUpdate = (await api.lightclient.getCommitteeUpdates(_syncCommitteePeriod, _syncCommitteePeriod)).data[0];
    const finalizedBlockHeader = committeeUpdate.header;
    const finalizedSlot = finalizedBlockHeader.slot;
    const finalizedStateRoot = finalizedBlockHeader.stateRoot;
    const finalizedBlockRoot = (await api.beacon.getBlockRoot(finalizedSlot)).data;
    logger.info('finalized slot slot: ', committeeUpdate.header.slot);
    logger.info('finalizing slot: ', committeeUpdate.finalityHeader.slot);

    // const signedlatestBlockHeader = (await api.beacon.getBlockHeader(_slot ? _slot : "head")).data.header
    const latestBlockHeader = committeeUpdate.finalityHeader;
    const latestSlot = latestBlockHeader.slot;
    const latestBlockRoot = ssz.phase0.BeaconBlockHeader.hashTreeRoot(latestBlockHeader); // (await api.beacon.getBlockRoot(latestSlot)).data;
    const latestStateRoot = latestBlockHeader.stateRoot;

    // const snapshot = (await api.lightclient.getSnapshot(toHexString(finalizedBlockRoot))).data;
    // committeeUpdate.nextSyncCommittee
    // const { currentSyncCommittee } = snapshot;
    // logger.info('snapshot slot: ', snapshot.header.slot);
    // const { currentSyncCommitteeBranch } = snapshot;
    const { nextSyncCommitteeBranch } = committeeUpdate;
    const { nextSyncCommittee } = committeeUpdate;

    logger.info('latest block root: ', toHexString(latestBlockRoot));
    const stateRootBranch = ssz.phase0.BeaconBlockHeader.createTreeBackedFromStruct(latestBlockHeader).tree.getSingleProof(BigInt(11));
    // logger.info('stateRootBranch: ', stateRootBranch.map(toHexString));

    logger.info(
        'stateRootBranch valid: ',
        isValidMerkleBranch(
            latestStateRoot.valueOf() as Uint8Array,
            stateRootBranch,
            ...fromGindex(STATE_ROOT_INDEX),
            latestBlockRoot.valueOf() as Uint8Array,
        ),
    );

    const latestSlotBranch = ssz.phase0.BeaconBlockHeader.createTreeBackedFromStruct(latestBlockHeader).tree.getSingleProof(BigInt(8));
    // logger.info('latestSlotBranch: ', latestSlotBranch.map(toHexString));

    logger.info(
        'latestSlotBranch valid: ',
        isValidMerkleBranch(
            ssz.Slot.hashTreeRoot(latestSlot),
            latestSlotBranch,
            ...fromGindex(SLOT_INDEX),
            latestBlockRoot.valueOf() as Uint8Array,
        ),
    );

    const finalizedStateRootBranch = ssz.phase0.BeaconBlockHeader.createTreeBackedFromStruct(finalizedBlockHeader).tree.getSingleProof(BigInt(11));
    // logger.info('finalizedStateRootBranch: ', finalizedStateRootBranch.map(toHexString));

    logger.info(
        'finalizedStateRootBranch valid: ',
        isValidMerkleBranch(
            finalizedStateRoot.valueOf() as Uint8Array,
            finalizedStateRootBranch,
            ...fromGindex(STATE_ROOT_INDEX),
            finalizedBlockRoot.valueOf() as Uint8Array,
        ),
    );

    const finalizedSlotBranch = ssz.phase0.BeaconBlockHeader.createTreeBackedFromStruct(finalizedBlockHeader).tree.getSingleProof(BigInt(8));
    // logger.info('finalizedSlotBranch: ', finalizedSlotBranch.map(toHexString));

    logger.info(
        'finalizedSlotBranch valid: ',
        isValidMerkleBranch(
            ssz.Slot.hashTreeRoot(finalizedSlot),
            finalizedSlotBranch,
            ...fromGindex(SLOT_INDEX),
            finalizedBlockRoot.valueOf() as Uint8Array,
        ),
    );

    logger.info(
        'nextSyncCommitteeBranch valid: ',
        isValidMerkleBranch(
            ssz.altair.SyncCommittee.hashTreeRoot(nextSyncCommittee),
            Array.from(nextSyncCommitteeBranch).map((val) => val.valueOf() as Uint8Array),
            ...fromGindex(NEXT_SYNC_COMMITTEE_INDEX),
            finalizedStateRoot.valueOf() as Uint8Array,
        ),
    );

    // logger.info(
    //     'currentSyncCommitteeBranch valid: ',
    //     isValidMerkleBranch(
    //         ssz.altair.SyncCommittee.hashTreeRoot(currentSyncCommittee),
    //         Array.from(currentSyncCommitteeBranch).map((val) => val.valueOf() as Uint8Array),
    //         ...fromGindex(CURRENT_SYNC_COMMITTEE_INDEX),
    //         committeeUpdate.finalityHeader.stateRoot.valueOf() as Uint8Array,
    //     ),
    // );

    logger.info(
        'finalizingBranch valid: ',
        isValidMerkleBranch(
            finalizedBlockRoot.valueOf() as Uint8Array,
            Array.from(committeeUpdate.finalityBranch).map((val) => val.valueOf() as Uint8Array),
            ...fromGindex(FINALIZED_ROOT_INDEX),
            latestStateRoot.valueOf() as Uint8Array,
        ),
    );

    logger.info('state root: ', toHexString(latestStateRoot));
    logger.info('body root: ', toHexString(latestBlockHeader.bodyRoot));

    logger.info('finalized block state root: ', toHexString(finalizedStateRoot));

    const { genesisValidatorsRoot } = (await api.beacon.getGenesis()).data;
    const beaconConfig: IBeaconConfig = createIBeaconConfig(config, genesisValidatorsRoot);
    const domain = beaconConfig.getDomain(DOMAIN_SYNC_COMMITTEE, latestSlot);

    logger.info(`latest slot: ${latestSlot}`);
    logger.info(`finalized slot: ${finalizedSlot}`);

    // const syncCommittee = currentSyncCommittee.pubkeys; // currently hard coded, may be next committee as well
    // const syncCommitteeBranch = currentSyncCommitteeBranch;
    // const syncCommitteeAggregate = currentSyncCommittee.aggregatePubkey;

    // const syncCommittee = nextSyncCommittee.pubkeys; // currently hard coded, may be current committee as well
    // const syncCommitteeBranch = nextSyncCommitteeBranch;
    // const syncCommitteeAggregate = nextSyncCommittee.aggregatePubkey;

    const prevCommitteeUpdate = (await api.lightclient.getCommitteeUpdates(_syncCommitteePeriod - 1, _syncCommitteePeriod - 1)).data[0];
    const syncCommittee = prevCommitteeUpdate.nextSyncCommittee.pubkeys; // currently hard coded, may be current committee as well
    const syncCommitteeBranch = prevCommitteeUpdate.nextSyncCommitteeBranch;
    const syncCommitteeAggregate = prevCommitteeUpdate.nextSyncCommittee.aggregatePubkey;
    return {
        signature: toHexString(committeeUpdate.syncCommitteeSignature),
        participants: Array.from(committeeUpdate.syncCommitteeBits),
        latestBlockRoot: toHexString(latestBlockRoot),
        signingDomain: toHexString(domain),
        stateRoot: toHexString(latestStateRoot),
        stateRootBranch: stateRootBranch.map(toHexString),
        latestSlot,
        latestSlotBranch: latestSlotBranch.map(toHexString),
        finalizedBlockRoot: toHexString(finalizedBlockRoot),
        finalizingBranch: Array.from(committeeUpdate.finalityBranch).map(toHexString),
        finalizedSlot,
        finalizedSlotBranch: finalizedSlotBranch.map(toHexString),
        finalizedStateRoot: toHexString(finalizedStateRoot),
        finalizedStateRootBranch: finalizedStateRootBranch.map(toHexString),
        syncCommittee: Array.from(syncCommittee).map(toHexString),
        syncCommitteeAggregate: toHexString(syncCommitteeAggregate),
        syncCommitteeBranch: Array.from(syncCommitteeBranch).map(toHexString),
    };
};

export const getBlockUpdateForEpoch = async (
    _epoch: number,
    _url = 'http://localhost:9596',
): Promise<ChainRelayUpdate> => {
    const syncCommitteePeriod = computeSyncPeriodAtEpoch(config, _epoch);
    return getBlockUpdateData(
        syncCommitteePeriod,
        _url,
    );
};
