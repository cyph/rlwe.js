# rlwe.js

## Overview

The [R-LWE](https://en.wikipedia.org/wiki/Ring_learning_with_errors_key_exchange) post-quantum asymmetric
cipher compiled to pure JavaScript using [Emscripten](https://github.com/kripken/emscripten).
The specific implementation in use is [from Microsoft Research](https://research.microsoft.com/en-us/projects/latticecrypto).
A simple wrapper is provided to make R-LWE easy to use in web applications.

The parameters are configured to 128-bit strength. (More specifically, the security level is
128 quantum bits and 128 classical bits.)

## Example Usage

	const aliceKeyPair	= rlwe.aliceKeyPair();
	/* {publicKey: Uint8Array; privateKey: Uint8Array;} */

	const bob			= rlwe.bobSecret(aliceKeyPair.publicKey);
	/* {publicKey: Uint8Array; secret: Uint8Array;} */

	const aliceSecret	= rlwe.aliceSecret(bob.publicKey, aliceKeyPair.privateKey);
	/* Uint8Array */

	// bob.secret and aliceSecret are equal

Note: This library only handles generating shared secrets; you'll need to handle key derivation
and symmetric encryption from there.
