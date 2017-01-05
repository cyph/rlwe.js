all:
	rm -rf dist LatticeCrypto_v1.0 libsodium 2> /dev/null
	mkdir dist

	git clone -b stable https://github.com/jedisct1/libsodium.git
	cd libsodium ; emconfigure ./configure --enable-minimal --disable-shared

	wget https://download.microsoft.com/download/7/3/3/733A6839-E6F3-4E6D-A91E-CC6E9F4EAACA/LatticeCrypto_v1.0.zip
	unzip LatticeCrypto_v1.0.zip
	rm LatticeCrypto_v1.0.zip
	cd LatticeCrypto_v1.0 ; mv kex.c tmp ; echo '#include <stdlib.h>' > kex.c ; cat tmp >> kex.c ; rm tmp

	bash -c ' \
		args="$$(echo " \
			--memory-init-file 0 \
			-D _GENERIC_ -D __LINUX__ -D _X86_ \
			-s TOTAL_MEMORY=65536 -s TOTAL_STACK=32768 \
			-s NO_DYNAMIC_EXECUTION=1 -s RUNNING_JS_OPTS=1 -s ASSERTIONS=0 \
			-s AGGRESSIVE_VARIABLE_ELIMINATION=1 -s ALIASING_FUNCTION_POINTERS=1 \
			-s FUNCTION_POINTER_ALIGNMENT=1 -s DISABLE_EXCEPTION_CATCHING=1 \
			-s RESERVED_FUNCTION_POINTERS=8 -s NO_FILESYSTEM=1 \
			-Ilibsodium/src/libsodium/include/sodium \
			-ILatticeCrypto_v1.0 \
			libsodium/src/libsodium/sodium/utils.c \
			libsodium/src/libsodium/randombytes/randombytes.c \
			$$(ls libsodium/src/libsodium/crypto_stream/*.c) \
			$$(ls libsodium/src/libsodium/crypto_stream/chacha20/*.c) \
			$$(ls libsodium/src/libsodium/crypto_stream/chacha20/ref/*.c) \
			$$(ls LatticeCrypto_v1.0/*.c LatticeCrypto_v1.0/generic/*.c) \
			rlwe.c \
			-s EXPORTED_FUNCTIONS=\"[ \
				'"'"'_rlwejs_init'"'"', \
				'"'"'_rlwejs_keypair_alice'"'"', \
				'"'"'_rlwejs_secret_alice'"'"', \
				'"'"'_rlwejs_secret_bob'"'"', \
				'"'"'_rlwejs_public_key_bytes'"'"', \
				'"'"'_rlwejs_private_key_bytes'"'"', \
				'"'"'_rlwejs_secret_bytes'"'"' \
			]\" \
			--pre-js pre.js --post-js post.js \
		" | perl -pe "s/\s+/ /g" | perl -pe "s/\[ /\[/g" | perl -pe "s/ \]/\]/g")"; \
		\
		bash -c "emcc -O3 $$args -o dist/rlwe.js"; \
		bash -c "emcc -O0 -g4 $$args -s DISABLE_EXCEPTION_CATCHING=0 -s ASSERTIONS=2 -o dist/rlwe.debug.js"; \
	'

	sed -i 's|require(|eval("require")(|g' dist/rlwe.js

	rm -rf LatticeCrypto_v1.0 libsodium

clean:
	rm -rf dist LatticeCrypto_v1.0 libsodium
