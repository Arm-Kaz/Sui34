// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    Ed25519PublicKey,
    type SerializedSignature,
    type SignatureScheme,
    SignerWithProvider,
    type SuiAddress,
    toSerializedSignature,
    type JsonRpcProvider,
    type HardenedEd25519Path,
} from '@mysten/sui.js';

import type SuiLedgerClient from '@mysten/ledgerjs-hw-app-sui';

export class LedgerSigner extends SignerWithProvider {
    #suiLedgerClient: SuiLedgerClient | null;
    readonly #connectToLedger: () => Promise<SuiLedgerClient>;
    readonly #derivationPath: HardenedEd25519Path;
    readonly #signatureScheme: SignatureScheme = 'ED25519';

    constructor(
        connectToLedger: () => Promise<SuiLedgerClient>,
        derivationPath: HardenedEd25519Path,
        provider: JsonRpcProvider
    ) {
        super(provider);
        this.#connectToLedger = connectToLedger;
        this.#suiLedgerClient = null;
        this.#derivationPath = derivationPath;
    }

    async #initializeSuiLedgerClient() {
        if (!this.#suiLedgerClient) {
            // We want to make sure that there's only one connection established per Ledger signer
            // instance since some methods make multiple calls like getAddress and signData
            this.#suiLedgerClient = await this.#connectToLedger();
        }
        return this.#suiLedgerClient;
    }

    async getAddress(): Promise<SuiAddress> {
        const ledgerClient = await this.#initializeSuiLedgerClient();
        const publicKeyResult = await ledgerClient.getPublicKey(
            this.#derivationPath
        );
        const publicKey = new Ed25519PublicKey(publicKeyResult.publicKey);
        return publicKey.toSuiAddress();
    }

    async getPublicKey(): Promise<Ed25519PublicKey> {
        const ledgerClient = await this.#initializeSuiLedgerClient();
        const { publicKey } = await ledgerClient.getPublicKey(
            this.#derivationPath
        );
        return new Ed25519PublicKey(publicKey);
    }

    async signData(data: Uint8Array): Promise<SerializedSignature> {
        const ledgerClient = await this.#initializeSuiLedgerClient();
        const { signature } = await ledgerClient.signTransaction(
            this.#derivationPath,
            data
        );
        const pubKey = await this.getPublicKey();
        return toSerializedSignature({
            signature,
            signatureScheme: this.#signatureScheme,
            pubKey,
        });
    }

    connect(provider: JsonRpcProvider): SignerWithProvider {
        return new LedgerSigner(
            this.#connectToLedger,
            this.#derivationPath,
            provider
        );
    }
}
