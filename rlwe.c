#include <stdlib.h>
#include <time.h>
#include "LatticeCrypto_priv.h"
#include "LatticeCrypto.h"
#include "randombytes.h"


PLatticeCryptoStruct lattice;

long public_key_bytes	= PKB_BYTES;
long private_key_bytes	= 4096;


CRYPTO_STATUS rlwejs_randombytes (unsigned int nbytes, unsigned char* random_array) {
	randombytes_buf(random_array, nbytes);
	return CRYPTO_SUCCESS;
}

CRYPTO_STATUS rlwejs_init () {
	randombytes_stir();

	lattice	= LatticeCrypto_allocate();

	return LatticeCrypto_initialize(
		lattice,
		rlwejs_randombytes,
		NULL,
		NULL
	);
}

long rlwejs_public_key_bytes () {
	return public_key_bytes + 1;
}

long rlwejs_private_key_bytes () {
	return private_key_bytes + 1;
}

long rlwejs_secret_bytes () {
	return SHAREDKEY_BYTES;
}

CRYPTO_STATUS rlwejs_keypair_alice (
	uint8_t public_key[],
	int32_t private_key[]
) {
	CRYPTO_STATUS status	= KeyGeneration_A(private_key, public_key, lattice);

	public_key[public_key_bytes]	= 1;
	private_key[private_key_bytes]	= 1;

	return status;
}

CRYPTO_STATUS rlwejs_secret_alice (
	uint8_t public_key[],
	int32_t private_key[],
	uint8_t* secret
) {
	if (public_key[public_key_bytes] || !private_key[private_key_bytes]) {
		return CRYPTO_ERROR_INVALID_PARAMETER;
	}

	return SecretAgreement_A(public_key, private_key, secret);
}

CRYPTO_STATUS rlwejs_secret_bob (
	uint8_t public_key_alice[],
	uint8_t public_key_bob[],
	uint8_t* secret
) {
	if (!public_key_alice[public_key_bytes]) {
		return CRYPTO_ERROR_INVALID_PARAMETER;
	}

	return SecretAgreement_B(public_key_alice, secret, public_key_bob, lattice);
}
