all:
	rm -rf dist LatticeCrypto_v1.0 libsodium 2> /dev/null
	mkdir dist

	git clone --depth 1 -b stable https://github.com/jedisct1/libsodium
	cd libsodium ; emconfigure ./configure --enable-minimal --disable-shared

	wget https://download.microsoft.com/download/7/3/3/733A6839-E6F3-4E6D-A91E-CC6E9F4EAACA/LatticeCrypto_v1.0.zip
	unzip LatticeCrypto_v1.0.zip
	rm LatticeCrypto_v1.0.zip
	cd LatticeCrypto_v1.0 ; mv kex.c tmp ; echo '#include <stdlib.h>' > kex.c ; cat tmp >> kex.c ; rm tmp

	bash -c ' \
		args="$$(echo " \
			-s SINGLE_FILE=1 \
			-D_GENERIC_ -D__LINUX__ -D_X86_ \
			-s TOTAL_MEMORY=16777216 -s TOTAL_STACK=8388608 \
			-s ASSERTIONS=0 \
			-s AGGRESSIVE_VARIABLE_ELIMINATION=1 \
			-s ALIASING_FUNCTION_POINTERS=1 \
			-s DISABLE_EXCEPTION_CATCHING=1 \
			-s NO_FILESYSTEM=1 \
			-Ilibsodium/src/libsodium/include/sodium \
			-ILatticeCrypto_v1.0 \
			libsodium/src/libsodium/sodium/utils.c \
			libsodium/src/libsodium/randombytes/randombytes.c \
			$$(ls libsodium/src/libsodium/crypto_stream/*.c) \
			$$(ls libsodium/src/libsodium/crypto_stream/chacha20/*.c) \
			$$(ls libsodium/src/libsodium/crypto_stream/chacha20/ref/*.c) \
			$$(ls LatticeCrypto_v1.0/*.c LatticeCrypto_v1.0/generic/*.c) \
			rlwe.c \
			-s EXTRA_EXPORTED_RUNTIME_METHODS=\"[ \
				'"'"'writeArrayToMemory'"'"' \
			]\" \
			-s EXPORTED_FUNCTIONS=\"[ \
				'"'"'_free'"'"', \
				'"'"'_malloc'"'"', \
				'"'"'_rlwejs_init'"'"', \
				'"'"'_rlwejs_keypair_alice'"'"', \
				'"'"'_rlwejs_secret_alice'"'"', \
				'"'"'_rlwejs_secret_bob'"'"', \
				'"'"'_rlwejs_public_key_bytes'"'"', \
				'"'"'_rlwejs_private_key_bytes'"'"', \
				'"'"'_rlwejs_secret_bytes'"'"' \
			]\" \
		" | perl -pe "s/\s+/ /g" | perl -pe "s/\[ /\[/g" | perl -pe "s/ \]/\]/g")"; \
		\
		bash -c "emcc -Oz -s RUNNING_JS_OPTS=1 $$args -o dist/rlwe.asm.js"; \
		bash -c "emcc -O3 -s WASM=1 $$args -o dist/rlwe.wasm.js"; \
	'

	cp pre.js dist/rlwe.tmp.js
	echo " \
		var Module = {}; \
		var _Module = Module; \
		Module.ready = new Promise(function (resolve, reject) { \
			var Module = _Module; \
			Module.onAbort = reject; \
			Module.onRuntimeInitialized = resolve; \
	" >> dist/rlwe.tmp.js
	cat dist/rlwe.wasm.js >> dist/rlwe.tmp.js
	echo " \
		}).catch(function () { \
			var Module = _Module; \
			Module.onAbort = undefined; \
			Module.onRuntimeInitialized = undefined; \
	" >> dist/rlwe.tmp.js
	cat dist/rlwe.asm.js >> dist/rlwe.tmp.js
	echo " \
		}); \
	" >> dist/rlwe.tmp.js
	cat post.js >> dist/rlwe.tmp.js

	uglifyjs dist/rlwe.tmp.js -cmo dist/rlwe.js

	sed -i 's|use asm||g' dist/rlwe.js
	sed -i 's|require(|eval("require")(|g' dist/rlwe.js

	rm -rf LatticeCrypto_v1.0 libsodium dist/rlwe.*.js

clean:
	rm -rf dist LatticeCrypto_v1.0 libsodium
