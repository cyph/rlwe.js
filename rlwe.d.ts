export interface IRLWE {
	/** Length of shared secret. */
	bytes: number;

	/** Private key length. */
	privateKeyBytes: number;

	/** Public key length. */
	publicKeyBytes: number;

	/** First step: generates key pair for Alice. */
	aliceKeyPair () : {privateKey: Uint8Array; publicKey: Uint8Array};

	/** Third step: uses Bob's public key to produce the same shared secret for Alice. */
	aliceSecret (publicKey: Uint8Array, privateKey: Uint8Array) : Uint8Array;

	/** Second step: uses Alice's public key to generate public key and shared secret for Bob. */
	bobSecret (alicePublicKey: Uint8Array) : {publicKey: Uint8Array; secret: Uint8Array};
};

export const rlwe: IRLWE;
