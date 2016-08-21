;

function dataReturn (returnValue, result) {
	if (returnValue === 0) {
		return result;
	}
	else {
		throw new Error('R-LWE error: ' + returnValue);
	}
}

function dataResult (buffer, bytes) {
	return new Uint8Array(
		new Uint8Array(Module.HEAPU8.buffer, buffer, bytes)
	);
}

function dataFree (buffer) {
	try {
		Module._free(buffer);
	}
	catch (_) {}
}


Module._rlwejs_init();


var rlwe	= {
	publicKeyLength: Module._rlwejs_public_key_bytes(),
	privateKeyLength: Module._rlwejs_private_key_bytes(),
	secretLength: Module._rlwejs_secret_bytes(),

	aliceKeyPair: function () {
		var publicKeyBuffer		= Module._malloc(rlwe.publicKeyLength);
		var privateKeyBuffer	= Module._malloc(rlwe.privateKeyLength);

		try {
			var returnValue	= Module._rlwejs_keypair_alice(
				publicKeyBuffer,
				privateKeyBuffer
			);

			return dataReturn(returnValue, {
				publicKey: dataResult(publicKeyBuffer, rlwe.publicKeyLength),
				privateKey: dataResult(privateKeyBuffer, rlwe.privateKeyLength)
			});
		}
		finally {
			dataFree(publicKeyBuffer);
			dataFree(privateKeyBuffer);
		}
	},

	aliceSecret: function (publicKey, privateKey) {
		var publicKeyBuffer		= Module._malloc(rlwe.publicKeyLength);
		var privateKeyBuffer	= Module._malloc(rlwe.privateKeyLength);
		var secretBuffer		= Module._malloc(rlwe.secretLength);

		Module.writeArrayToMemory(publicKey, publicKeyBuffer);
		Module.writeArrayToMemory(privateKey, privateKeyBuffer);

		try {
			var returnValue	= Module._rlwejs_secret_alice(
				publicKeyBuffer,
				privateKeyBuffer,
				secretBuffer
			);

			return dataReturn(
				returnValue,
				dataResult(secretBuffer, rlwe.secretLength)
			);
		}
		finally {
			dataFree(publicKeyBuffer);
			dataFree(privateKeyBuffer);
			dataFree(secretBuffer);
		}
	},

	bobSecret: function (alicePublicKey) {
		var alicePublicKeyBuffer	= Module._malloc(rlwe.publicKeyLength);
		var bobPublicKeyBuffer		= Module._malloc(rlwe.publicKeyLength);
		var secretBuffer			= Module._malloc(rlwe.secretLength);

		Module.writeArrayToMemory(
			alicePublicKey,
			alicePublicKeyBuffer
		);

		try {
			var returnValue	= Module._rlwejs_secret_bob(
				alicePublicKeyBuffer,
				bobPublicKeyBuffer,
				secretBuffer
			);

			return dataReturn(returnValue, {
				publicKey: dataResult(bobPublicKeyBuffer, rlwe.publicKeyLength),
				secret: dataResult(secretBuffer, rlwe.secretLength)
			});
		}
		finally {
			dataFree(alicePublicKeyBuffer);
			dataFree(bobPublicKeyBuffer);
			dataFree(secretBuffer);
		}
	}
};



return rlwe;

}());

self.rlwe	= rlwe;