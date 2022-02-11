export interface ChainRelayUpdate {
    signature: string;
    participants: boolean[];
    latestBlockRoot: string;
    signingDomain: string;
    stateRoot: string;
    stateRootBranch: string[];
    latestSlot: number;
    latestSlotBranch: string[];
    finalizedBlockRoot: string;
    finalizingBranch: string[];
    finalizedSlot: number;
    finalizedSlotBranch: string[];
    finalizedStateRoot: string;
    finalizedStateRootBranch: string[];
    syncCommittee: string[];
    syncCommitteeAggregate: string;
    syncCommitteeBranch: string[];
}
