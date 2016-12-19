var rlwe = (function () {

// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');

    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    // The path is absolute if the normalized version is the same as the resolved.
    if (!ret && filename != nodePath['resolve'](filename)) {
      filename = path.join(__dirname, '..', 'src', filename);
      ret = nodeFS['readFileSync'](filename);
    }
    if (ret && !binary) ret = ret.toString();
    return ret;
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available (jsc?)' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  abort('NO_DYNAMIC_EXECUTION=1 was set, cannot eval');
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in: 
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at: 
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      assert(args.length == sig.length-1);
      if (!args.splice) args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].apply(null, args);
    } else {
      assert(sig.length == 1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [null,null,null,null,null,null,null,null],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 1*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-1)/1] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      sigCache[func] = function dynCall_wrapper() {
        return Runtime.dynCall(sig, func, arguments);
      };
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16);(assert((((STACKTOP|0) < (STACK_MAX|0))|0))|0); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + (assert(!staticSealed),size))|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + (assert(DYNAMICTOP > 0),size))|0;DYNAMICTOP = (((DYNAMICTOP)+15)&-16); if (DYNAMICTOP >= TOTAL_MEMORY) { var success = enlargeMemory(); if (!success) { DYNAMICTOP = ret;  return 0; } }; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*(+4294967296))) : ((+((low>>>0)))+((+((high|0)))*(+4294967296)))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    abort('NO_DYNAMIC_EXECUTION=1 was set, cannot eval');
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        ret = Runtime.stackAlloc((str.length << 2) + 1);
        writeStringToMemory(str, ret);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface. 
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    assert(returnType !== 'array', 'Return type should not be "array".');
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if ((!opts || !opts.async) && typeof EmterpreterAsync === 'object') {
      assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling ccall');
    }
    if (opts && opts.async) assert(!returnType, 'async ccalls cannot return values');
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  // NO_DYNAMIC_EXECUTION is on, so we can't use the fast version of cwrap.
  // Fall back to returning a bound version of ccall.
  cwrap = function cwrap(ident, returnType, argTypes) {
    return function() {
      Runtime.warnOnce('NO_DYNAMIC_EXECUTION was set, '
                     + 'using slow cwrap implementation');
      return ccall(ident, returnType, argTypes, arguments);
    }
  }
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if ((typeof _sbrk !== 'undefined' && !_sbrk.called) || !runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

function UTF8ArrayToString(u8Array, idx) {
  var u0, u1, u2, u3, u4, u5;

  var str = '';
  while (1) {
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    u0 = u8Array[idx++];
    if (!u0) return str;
    if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
    u1 = u8Array[idx++] & 63;
    if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
    u2 = u8Array[idx++] & 63;
    if ((u0 & 0xF0) == 0xE0) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u3 = u8Array[idx++] & 63;
      if ((u0 & 0xF8) == 0xF0) {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
      } else {
        u4 = u8Array[idx++] & 63;
        if ((u0 & 0xFC) == 0xF8) {
          u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
        } else {
          u5 = u8Array[idx++] & 63;
          u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
        }
      }
    }
    if (u0 < 0x10000) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF16ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
    if (codeUnit == 0)
      return str;
    ++i;
    // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
    str += String.fromCharCode(codeUnit);
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null 
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var hasLibcxxabi = !!Module['___cxa_demangle'];
  if (hasLibcxxabi) {
    try {
      var buf = _malloc(func.length);
      writeStringToMemory(func.substr(1), buf);
      var status = _malloc(4);
      var ret = Module['___cxa_demangle'](buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed, we can try ours which may return a partial result
    } catch(e) {
      // failure when using libcxxabi, we can try ours which may return a partial result
      return func;
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  return text.replace(/__Z[\w\d_]+/g, function(x) { var y = demangle(x); return x === y ? x : (x + ' [' + y + ']') });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  return demangleAll(jsStackTrace());
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += (4096 - (x % 4096));
  }
  return x;
}

var HEAP;
var buffer;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}

function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 32768;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 65536;

var totalMemory = 64*1024;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  Module.printErr('increasing TOTAL_MEMORY to ' + totalMemory + ' to be compliant with the asm.js spec (and given that TOTAL_STACK=' + TOTAL_STACK + ')');
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  buffer = new ArrayBuffer(TOTAL_MEMORY);
}
updateGlobalBufferViews();


// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
if (HEAPU8[0] !== 255 || HEAPU8[3] !== 0) throw 'Typed arrays 2 must be run on a little-endian system';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))>>0)]=chr;
    i = i + 1;
  }
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[((buffer++)>>0)]=array[i];
  }
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;

// === Body ===

var ASM_CONSTS = [function() { { return Module.getRandomValue(); } },
 function() { { if (Module.getRandomValue === undefined) { try { var window_ = "object" === typeof window ? window : self, crypto_ = typeof window_.crypto !== "undefined" ? window_.crypto : window_.msCrypto, randomValuesStandard = function() { var buf = new Uint32Array(1); crypto_.getRandomValues(buf); return buf[0] >>> 0; }; randomValuesStandard(); Module.getRandomValue = randomValuesStandard; } catch (e) { try { var crypto = require('crypto'), randomValueNodeJS = function() { var buf = crypto.randomBytes(4); return (buf[0] << 24 | buf[1] << 16 | buf[2] << 8 | buf[3]) >>> 0; }; randomValueNodeJS(); Module.getRandomValue = randomValueNodeJS; } catch (e) { throw 'No secure random number generator found'; } } } } }];

function _emscripten_asm_const_i(code) {
 return ASM_CONSTS[code]();
}

function _emscripten_asm_const_v(code) {
 return ASM_CONSTS[code]();
}



STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 9536;
  /* global initializers */  __ATINIT__.push();
  

/* memory initializer */ allocate([12,0,0,0,18,0,0,0,19,0,0,0,18,0,0,0,18,0,0,0,25,10,0,0,201,42,0,0,1,32,0,0,237,1,0,0,189,26,0,0,180,38,0,0,98,5,0,0,137,40,0,0,16,31,0,0,179,1,0,0,162,39,0,0,41,4,0,0,148,1,0,0,220,29,0,0,183,4,0,0,176,12,0,0,113,43,0,0,157,20,0,0,133,9,0,0,62,14,0,0,171,11,0,0,134,23,0,0,139,38,0,0,106,24,0,0,118,39,0,0,251,37,0,0,234,3,0,0,110,28,0,0,188,16,0,0,33,28,0,0,107,3,0,0,196,14,0,0,71,6,0,0,112,19,0,0,210,31,0,0,106,18,0,0,242,0,0,0,1,6,0,0,120,14,0,0,139,37,0,0,155,19,0,0,33,2,0,0,220,19,0,0,161,41,0,0,21,19,0,0,8,44,0,0,250,11,0,0,230,47,0,0,179,14,0,0,97,42,0,0,96,11,0,0,66,22,0,0,159,46,0,0,253,18,0,0,109,28,0,0,80,38,0,0,236,43,0,0,43,11,0,0,20,28,0,0,43,4,0,0,97,9,0,0,71,46,0,0,134,1,0,0,252,44,0,0,63,33,0,0,249,14,0,0,220,10,0,0,182,27,0,0,31,19,0,0,204,5,0,0,1,9,0,0,178,19,0,0,44,32,0,0,85,10,0,0,195,30,0,0,226,36,0,0,126,8,0,0,237,30,0,0,153,6,0,0,36,13,0,0,217,15,0,0,199,12,0,0,111,42,0,0,46,18,0,0,241,6,0,0,130,41,0,0,52,14,0,0,183,28,0,0,113,37,0,0,86,27,0,0,160,0,0,0,77,12,0,0,85,17,0,0,254,47,0,0,139,39,0,0,75,15,0,0,202,28,0,0,144,47,0,0,208,15,0,0,201,8,0,0,68,11,0,0,129,4,0,0,143,35,0,0,226,26,0,0,78,8,0,0,163,41,0,0,182,13,0,0,212,20,0,0,49,11,0,0,191,38,0,0,104,36,0,0,119,32,0,0,131,37,0,0,82,35,0,0,200,11,0,0,14,47,0,0,73,36,0,0,98,45,0,0,186,27,0,0,64,12,0,0,162,38,0,0,72,13,0,0,130,8,0,0,8,6,0,0,183,21,0,0,164,1,0,0,112,32,0,0,41,19,0,0,220,1,0,0,203,13,0,0,110,36,0,0,32,19,0,0,195,38,0,0,235,11,0,0,19,12,0,0,81,0,0,0,232,3,0,0,224,16,0,0,153,4,0,0,98,31,0,0,49,37,0,0,158,41,0,0,43,45,0,0,254,29,0,0,196,40,0,0,117,47,0,0,198,11,0,0,128,35,0,0,222,19,0,0,46,5,0,0,111,43,0,0,15,9,0,0,70,44,0,0,22,3,0,0,187,10,0,0,19,29,0,0,63,12,0,0,128,14,0,0,38,4,0,0,11,39,0,0,60,29,0,0,32,34,0,0,67,36,0,0,184,10,0,0,206,45,0,0,159,11,0,0,192,37,0,0,181,3,0,0,44,29,0,0,178,37,0,0,98,28,0,0,196,22,0,0,161,25,0,0,18,30,0,0,0,13,0,0,112,25,0,0,71,5,0,0,143,28,0,0,219,31,0,0,104,22,0,0,210,2,0,0,232,42,0,0,203,15,0,0,231,27,0,0,58,42,0,0,1,0,0,0,220,33,0,0,241,9,0,0,176,13,0,0,43,34,0,0,69,43,0,0,110,6,0,0,134,35,0,0,228,22,0,0,223,6,0,0,134,33,0,0,110,14,0,0,198,27,0,0,203,34,0,0,158,46,0,0,122,31,0,0,13,38,0,0,86,37,0,0,92,15,0,0,23,23,0,0,26,19,0,0,53,14,0,0,126,34,0,0,166,21,0,0,112,47,0,0,123,22,0,0,233,29,0,0,221,30,0,0,21,43,0,0,179,46,0,0,135,38,0,0,109,42,0,0,160,6,0,0,212,12,0,0,65,11,0,0,29,28,0,0,41,8,0,0,40,35,0,0,221,7,0,0,217,2,0,0,88,35,0,0,33,46,0,0,26,11,0,0,3,44,0,0,9,0,0,0,98,25,0,0,32,2,0,0,164,9,0,0,83,1,0,0,101,5,0,0,221,9,0,0,176,31,0,0,0,14,0,0,46,27,0,0,125,19,0,0,120,41,0,0,75,31,0,0,254,20,0,0,236,36,0,0,127,47,0,0,2,17,0,0,165,38,0,0,157,30,0,0,224,12,0,0,148,32,0,0,54,28,0,0,149,8,0,0,118,0,0,0,172,9,0,0,135,22,0,0,59,3,0,0,93,33,0,0,72,44,0,0,106,13,0,0,201,13,0,0,92,11,0,0,39,47,0,0,57,9,0,0,51,7,0,0,214,11,0,0,238,31,0,0,3,24,0,0,114,38,0,0,134,32,0,0,64,2,0,0,95,40,0,0,254,39,0,0,244,40,0,0,191,36,0,0,60,46,0,0,20,23,0,0,162,1,0,0,188,14,0,0,91,29,0,0,53,21,0,0,128,29,0,0,244,42,0,0,101,47,0,0,207,10,0,0,129,15,0,0,106,32,0,0,13,25,0,0,24,39,0,0,239,7,0,0,213,20,0,0,48,42,0,0,61,38,0,0,210,41,0,0,54,23,0,0,239,4,0,0,49,0,0,0,27,23,0,0,54,42,0,0,163,46,0,0,25,42,0,0,23,7,0,0,7,21,0,0,130,12,0,0,141,17,0,0,8,27,0,0,248,39,0,0,183,7,0,0,84,33,0,0,109,11,0,0,91,1,0,0,146,18,0,0,66,7,0,0,87,46,0,0,14,35,0,0,79,37,0,0,236,22,0,0,162,37,0,0,103,22,0,0,46,45,0,0,83,47,0,0,100,41,0,0,193,11,0,0,46,24,0,0,218,46,0,0,123,25,0,0,140,2,0,0,178,14,0,0,154,36,0,0,176,15,0,0,237,15,0,0,113,33,0,0,209,15,0,0,102,23,0,0,122,43,0,0,135,43,0,0,180,3,0,0,69,1,0,0,124,5,0,0,80,27,0,0,231,23,0,0,141,32,0,0,177,42,0,0,176,4,0,0,64,20,0,0,251,9,0,0,234,23,0,0,58,6,0,0,87,40,0,0,15,28,0,0,73,23,0,0,132,10,0,0,89,47,0,0,202,16,0,0,1,13,0,0,31,23,0,0,81,17,0,0,7,33,0,0,120,27,0,0,211,6,0,0,51,12,0,0,238,11,0,0,147,26,0,0,150,22,0,0,227,41,0,0,125,36,0,0,199,9,0,0,171,2,0,0,155,9,0,0,72,14,0,0,64,0,0,0,144,16,0,0,242,13,0,0,67,3,0,0,177,23,0,0,206,15,0,0,60,45,0,0,218,42,0,0,78,12,0,0,91,40,0,0,226,16,0,0,30,8,0,0,88,4,0,0,239,15,0,0,223,43,0,0,185,1,0,0,154,3,0,0,26,4,0,0,184,17,0,0,188,26,0,0,237,32,0,0,123,10,0,0,91,43,0,0,234,14,0,0,27,24,0,0,52,33,0,0,110,47,0,0,177,26,0,0,97,17,0,0,141,18,0,0,96,26,0,0,76,29,0,0,142,30,0,0,22,32,0,0,62,27,0,0,29,31,0,0,205,28,0,0,121,8,0,0,10,2,0,0,215,19,0,0,190,12,0,0,76,40,0,0,59,26,0,0,254,4,0,0,217,38,0,0,186,13,0,0,240,43,0,0,7,44,0,0,37,23,0,0,212,1,0,0,148,15,0,0,126,1,0,0,197,46,0,0,219,20,0,0,187,26,0,0,52,24,0,0,131,33,0,0,241,7,0,0,99,32,0,0,130,7,0,0,39,15,0,0,27,43,0,0,205,3,0,0,198,26,0,0,178,42,0,0,86,20,0,0,104,26,0,0,127,12,0,0,56,0,0,0,237,13,0,0,142,2,0,0,166,6,0,0,62,40,0,0,230,22,0,0,9,24,0,0,39,21,0,0,198,33,0,0,113,46,0,0,65,41,0,0,173,28,0,0,8,24,0,0,64,28,0,0,90,18,0,0,140,34,0,0,172,18,0,0,0,40,0,0,48,19,0,0,41,5,0,0,65,47,0,0,136,27,0,0,104,11,0,0,55,12,0,0,73,16,0,0,238,44,0,0,154,13,0,0,15,44,0,0,92,21,0,0,242,22,0,0,92,45,0,0,167,23,0,0,249,34,0,0,52,0,0,0,102,12,0,0,214,42,0,0,51,37,0,0,151,0,0,0,79,8,0,0,117,15,0,0,23,11,0,0,56,38,0,0,239,24,0,0,43,6,0,0,175,1,0,0,83,29,0,0,254,22,0,0,213,11,0,0,39,26,0,0,117,16,0,0,248,1,0,0,164,45,0,0,254,8,0,0,241,33,0,0,66,35,0,0,16,18,0,0,68,24,0,0,92,46,0,0,240,15,0,0,77,24,0,0,239,33,0,0,235,3,0,0,53,34,0,0,241,0,0,0,58,0,0,0,145,19,0,0,93,40,0,0,117,3,0,0,137,24,0,0,110,13,0,0,229,36,0,0,50,44,0,0,141,31,0,0,208,25,0,0,149,13,0,0,142,0,0,0,81,4,0,0,137,34,0,0,87,1,0,0,186,17,0,0,116,7,0,0,184,4,0,0,119,18,0,0,166,27,0,0,183,40,0,0,141,39,0,0,217,26,0,0,53,45,0,0,195,39,0,0,160,1,0,0,46,3,0,0,169,6,0,0,146,9,0,0,252,33,0,0,205,2,0,0,91,36,0,0,93,5,0,0,250,31,0,0,125,9,0,0,72,41,0,0,1,42,0,0,60,28,0,0,63,43,0,0,182,1,0,0,70,34,0,0,105,23,0,0,206,12,0,0,113,16,0,0,221,26,0,0,121,13,0,0,112,4,0,0,124,14,0,0,166,12,0,0,110,11,0,0,34,7,0,0,137,17,0,0,99,12,0,0,88,31,0,0,163,33,0,0,136,7,0,0,208,1,0,0,133,12,0,0,226,34,0,0,168,27,0,0,68,4,0,0,148,42,0,0,237,39,0,0,167,46,0,0,52,17,0,0,166,35,0,0,192,15,0,0,25,29,0,0,239,23,0,0,131,31,0,0,11,42,0,0,125,0,0,0,28,2,0,0,217,34,0,0,126,31,0,0,100,2,0,0,115,31,0,0,197,47,0,0,100,37,0,0,129,35,0,0,2,42,0,0,45,39,0,0,68,0,0,0,53,25,0,0,43,30,0,0,173,18,0,0,60,19,0,0,246,3,0,0,192,1,0,0,102,15,0,0,112,20,0,0,47,5,0,0,234,33,0,0,160,14,0,0,158,28,0,0,240,11,0,0,33,38,0,0,213,22,0,0,212,21,0,0,156,1,0,0,19,28,0,0,135,15,0,0,19,19,0,0,15,12,0,0,54,25,0,0,209,8,0,0,104,30,0,0,44,22,0,0,137,5,0,0,208,32,0,0,190,45,0,0,220,21,0,0,99,23,0,0,215,35,0,0,209,10,0,0,78,23,0,0,212,0,0,0,155,25,0,0,105,43,0,0,132,21,0,0,6,43,0,0,101,4,0,0,252,18,0,0,92,42,0,0,107,4,0,0,171,16,0,0,236,25,0,0,227,8,0,0,100,38,0,0,199,19,0,0,80,16,0,0,181,14,0,0,238,5,0,0,90,34,0,0,212,17,0,0,240,39,0,0,194,22,0,0,206,13,0,0,121,15,0,0,49,16,0,0,37,41,0,0,250,1,0,0,26,43,0,0,105,25,0,0,145,42,0,0,114,10,0,0,93,39,0,0,10,13,0,0,53,35,0,0,183,13,0,0,155,26,0,0,103,43,0,0,216,10,0,0,141,4,0,0,15,10,0,0,177,34,0,0,107,40,0,0,121,1,0,0,226,17,0,0,138,46,0,0,173,41,0,0,120,39,0,0,136,1,0,0,213,40,0,0,169,1,0,0,17,37,0,0,193,0,0,0,183,8,0,0,53,24,0,0,14,4,0,0,102,44,0,0,60,24,0,0,186,31,0,0,78,11,0,0,70,14,0,0,223,42,0,0,49,41,0,0,199,25,0,0,151,9,0,0,175,46,0,0,107,15,0,0,20,0,0,0,138,19,0,0,43,20,0,0,0,18,0,0,242,34,0,0,234,31,0,0,154,39,0,0,242,5,0,0,217,33,0,0,157,40,0,0,16,13,0,0,222,21,0,0,212,42,0,0,165,25,0,0,252,43,0,0,153,7,0,0,33,43,0,0,119,38,0,0,6,28,0,0,75,19,0,0,100,8,0,0,186,24,0,0,119,15,0,0,165,22,0,0,49,19,0,0,200,13,0,0,118,31,0,0,241,14,0,0,210,34,0,0,14,39,0,0,239,16,0,0,192,34,0,0,126,36,0,0,142,15,0,0,24,26,0,0,133,45,0,0,110,30,0,0,217,25,0,0,201,6,0,0,110,2,0,0,245,40,0,0,134,42,0,0,51,24,0,0,188,27,0,0,151,6,0,0,150,1,0,0,111,47,0,0,148,20,0,0,173,36,0,0,18,47,0,0,226,3,0,0,55,30,0,0,88,21,0,0,215,28,0,0,62,18,0,0,0,2,0,0,108,1,0,0,201,38,0,0,212,11,0,0,96,20,0,0,142,21,0,0,202,4,0,0,126,29,0,0,102,31,0,0,131,27,0,0,134,30,0,0,45,43,0,0,201,11,0,0,49,12,0,0,160,29,0,0,40,10,0,0,224,43,0,0,124,26,0,0,53,47,0,0,99,20,0,0,129,5,0,0,128,37,0,0,253,17,0,0,215,31,0,0,77,47,0,0,207,1,0,0,178,34,0,0,116,32,0,0,69,42,0,0,31,36,0,0,193,42,0,0,78,38,0,0,6,8,0,0,59,24,0,0,243,25,0,0,48,12,0,0,217,23,0,0,156,32,0,0,88,33,0,0,7,27,0,0,49,34,0,0,255,42,0,0,13,34,0,0,241,36,0,0,229,7,0,0,100,35,0,0,122,18,0,0,89,15,0,0,87,41,0,0,139,14,0,0,77,3,0,0,144,7,0,0,7,0,0,0,190,19,0,0,82,12,0,0,213,12,0,0,8,17,0,0,221,14,0,0,2,45,0,0,165,8,0,0,57,16,0,0,207,47,0,0,41,47,0,0,150,21,0,0,1,3,0,0,3,16,0,0,104,15,0,0,228,21,0,0,154,21,0,0,16,43,0,0,66,36,0,0,123,8,0,0,152,13,0,0,10,29,0,0,72,33,0,0,160,12,0,0,220,46,0,0,184,37,0,0,126,5,0,0,129,11,0,0,229,20,0,0,39,28,0,0,238,17,0,0,87,45,0,0,45,44,0,0,82,20,0,0,76,3,0,0,170,27,0,0,210,15,0,0,80,31,0,0,108,35,0,0,222,37,0,0,4,33,0,0,88,27,0,0,30,22,0,0,55,2,0,0,125,11,0,0,171,33,0,0,224,14,0,0,123,19,0,0,69,9,0,0,15,20,0,0,63,0,0,0,181,29,0,0,32,13,0,0,63,46,0,0,105,40,0,0,66,2,0,0,9,27,0,0,204,29,0,0,254,1,0,0,10,21,0,0,62,10,0,0,126,30,0,0,71,22,0,0,31,42,0,0,8,36,0,0,115,44,0,0,12,23,0,0,111,18,0,0,18,45,0,0,174,13,0,0,157,22,0,0,135,41,0,0,242,21,0,0,58,3,0,0,179,19,0,0,18,12,0,0,139,42,0,0,223,38,0,0,172,29,0,0,245,8,0,0,96,46,0,0,7,24,0,0,141,13,0,0,91,17,0,0,167,34,0,0,19,6,0,0,10,7,0,0,239,19,0,0,99,7,0,0,199,4,0,0,30,9,0,0,198,30,0,0,54,6,0,0,113,3,0,0,109,1,0,0,135,7,0,0,10,44,0,0,158,17,0,0,180,37,0,0,130,11,0,0,172,26,0,0,0,5,0,0,102,2,0,0,166,42,0,0,233,47,0,0,82,28,0,0,86,26,0,0,76,38,0,0,121,44,0,0,228,8,0,0,43,44,0,0,33,10,0,0,111,3,0,0,219,30,0,0,135,31,0,0,126,13,0,0,83,33,0,0,211,14,0,0,61,35,0,0,144,22,0,0,57,7,0,0,86,30,0,0,52,31,0,0,201,1,0,0,8,0,0,0,18,2,0,0,191,37,0,0,105,30,0,0,247,44,0,0,250,13,0,0,168,29,0,0,92,41,0,0,138,13,0,0,12,35,0,0,29,38,0,0,4,13,0,0,139,0,0,0,254,7,0,0,124,11,0,0,56,42,0,0,116,36,0,0,106,3,0,0,253,8,0,0,18,22,0,0,87,47,0,0,150,0,0,0,136,2,0,0,64,31,0,0,254,38,0,0,200,36,0,0,11,11,0,0,130,9,0,0,234,44,0,0,81,25,0,0,236,47,0,0,26,38,0,0,161,43,0,0,47,46,0,0,251,43,0,0,237,14,0,0,112,41,0,0,113,11,0,0,119,24,0,0,41,18,0,0,176,24,0,0,215,37,0,0,148,40,0,0,246,1,0,0,254,19,0,0,48,33,0,0,82,24,0,0,220,41,0,0,251,32,0,0,200,29,0,0,227,26,0,0,53,36,0,0,216,25,0,0,172,33,0,0,167,20,0,0,176,3,0,0,95,29,0,0,237,23,0,0,90,7,0,0,241,43,0,0,14,40,0,0,34,21,0,0,227,4,0,0,254,6,0,0,155,20,0,0,1,33,0,0,207,40,0,0,17,16,0,0,72,0,0,0,12,11,0,0,0,17,0,0,31,29,0,0,152,10,0,0,40,43,0,0,231,30,0,0,123,13,0,0,254,15,0,0,108,25,0,0,229,11,0,0,186,43,0,0,83,10,0,0,247,6,0,0,43,28,0,0,110,19,0,0,44,30,0,0,83,38,0,0,233,36,0,0,203,11,0,0,98,16,0,0,170,10,0,0,222,26,0,0,181,40,0,0,205,8,0,0,166,17,0,0,235,35,0,0,45,29,0,0,121,43,0,0,213,35,0,0,68,47,0,0,227,6,0,0,161,8,0,0,145,37,0,0,50,20,0,0,97,3,0,0,255,4,0,0,158,6,0,0,7,42,0,0,228,32,0,0,71,17,0,0,59,41,0,0,231,14,0,0,200,22,0,0,187,42,0,0,1,32,0,0,20,46,0,0,77,9,0,0,68,21,0,0,78,46,0,0,241,16,0,0,120,7,0,0,159,42,0,0,100,27,0,0,144,4,0,0,81,35,0,0,74,43,0,0,37,18,0,0,109,46,0,0,216,43,0,0,95,8,0,0,145,28,0,0,186,41,0,0,61,33,0,0,150,44,0,0,224,19,0,0,69,31,0,0,147,19,0,0,23,44,0,0,6,10,0,0,139,8,0,0,151,23,0,0,118,9,0,0,123,24,0,0,86,36,0,0,195,33,0,0,124,38,0,0,8,33,0,0,194,14,0,0,5,3,0,0,123,46,0,0,186,1,0,0,160,38,0,0,214,43,0,0,237,19,0,0,214,36,0,0,21,4,0,0,177,9,0,0,148,19,0,0,4,29,0,0,98,1,0,0,191,25,0,0,161,36,0,0,160,5,0,0,78,33,0,0,27,0,0,0,7,36,0,0,249,3,0,0,236,28,0,0,96,6,0,0,37,28,0,0,224,45,0,0,102,28,0,0,118,10,0,0,137,33,0,0,0,42,0,0,15,47,0,0,151,29,0,0,47,16,0,0,54,34,0,0,37,46,0,0,216,28,0,0,145,15,0,0,93,46,0,0,74,26,0,0,249,41,0,0,127,39,0,0,185,34,0,0,95,9,0,0,193,35,0,0,71,20,0,0,159,2,0,0,184,11,0,0,243,0,0,0,57,36,0,0,175,12,0,0,126,10,0,0,138,15,0,0,153,11,0,0,66,9,0,0,208,36,0,0,45,27,0,0,75,34,0,0,94,6,0,0,179,39,0,0,31,21,0,0,114,12,0,0,128,43,0,0,189,36,0,0,56,39,0,0,49,32,0,0,113,0,0,0,55,19,0,0,182,32,0,0,118,8,0,0,3,0,0,0,172,30,0,0,180,35,0,0,97,47,0,0,171,20,0,0,144,10,0,0,74,19,0,0,205,33,0,0,127,6,0,0,16,41,0,0,211,29,0,0,146,5,0,0,58,35,0,0,40,32,0,0,221,34,0,0,104,41,0,0,20,17,0,0,131,39,0,0,31,11,0,0,62,17,0,0,172,37,0,0,213,15,0,0,79,28,0,0,0,39,0,0,53,42,0,0,226,28,0,0,75,20,0,0,37,37,0,0,185,3,0,0,164,14,0,0,198,44,0,0,122,25,0,0,85,38,0,0,139,47,0,0,108,39,0,0,203,19,0,0,109,15,0,0,33,35,0,0,100,17,0,0,92,9,0,0,255,30,0,0,130,0,0,0,21,11,0,0,3,27,0,0,182,16,0,0,137,6,0,0,132,28,0,0,211,20,0,0,1,34,0,0,81,16,0,0,36,38,0,0,156,42,0,0,174,46,0,0,93,38,0,0,225,45,0,0,159,22,0,0,248,47,0,0,254,3,0,0,231,36,0,0,224,1,0,0,169,12,0,0,40,45,0,0,36,40,0,0,217,12,0,0,216,39,0,0,228,19,0,0,192,36,0,0,45,35,0,0,97,41,0,0,148,5,0,0,122,9,0,0,78,1,0,0,236,4,0,0,36,17,0,0,24,18,0,0,134,25,0,0,145,0,0,0,91,26,0,0,131,13,0,0,204,33,0,0,231,28,0,0,234,24,0,0,165,32,0,0,171,10,0,0,244,9,0,0,135,16,0,0,99,1,0,0,54,13,0,0,59,20,0,0,147,33,0,0,123,14,0,0,34,41,0,0,29,25,0,0,123,12,0,0,147,41,0,0,188,4,0,0,214,13,0,0,81,34,0,0,16,38,0,0,37,14,0,0,0,48,0,0,199,5,0,0,26,20,0,0,54,32,0,0,25,5,0,0,47,45,0,0,153,25,0,0,38,16,0,0,114,19,0,0,186,42,0,0,145,22,0,0,1,35,0,0,239,17,0,0,96,22,0,0,61,25,0,0,159,19,0,0,79,10,0,0,213,18,0,0,76,44,0,0,65,10,0,0,98,36,0,0,51,2,0,0,73,37,0,0,190,11,0,0,225,13,0,0,197,18,0,0,246,8,0,0,219,43,0,0,129,33,0,0,194,35,0,0,238,18,0,0,70,37,0,0,235,44,0,0,187,3,0,0,242,38,0,0,146,4,0,0,211,42,0,0,35,28,0,0,129,12,0,0,59,36,0,0,140,0,0,0,61,7,0,0,3,18,0,0,214,2,0,0,99,6,0,0,208,10,0,0,159,16,0,0,104,43,0,0,33,31,0,0,25,44,0,0,176,47,0,0,238,35,0,0,22,36,0,0,62,9,0,0,225,28,0,0,147,11,0,0,176,43,0,0,115,47,0,0,108,34,0,0,49,22,0,0,116,16,0,0,207,3,0,0,28,11,0,0,147,34,0,0,120,23,0,0,140,44,0,0,164,7,0,0,112,28,0,0,199,47,0,0,16,47,0,0,204,13,0,0,22,44,0,0,18,14,0,0,180,23,0,0,17,32,0,0,165,1,0,0,189,23,0,0,241,29,0,0,191,12,0,0,16,14,0,0,3,39,0,0,93,2,0,0,9,46,0,0,140,31,0,0,218,21,0,0,44,36,0,0,3,25,0,0,174,18,0,0,82,46,0,0,214,41,0,0,18,23,0,0,201,9,0,0,234,36,0,0,140,32,0,0,178,39,0,0,106,47,0,0,206,10,0,0,43,5,0,0,155,35,0,0,205,47,0,0,8,13,0,0,90,24,0,0,165,2,0,0,15,25,0,0,165,26,0,0,242,3,0,0,103,34,0,0,19,3,0,0,184,31,0,0,202,35,0,0,153,36,0,0,121,20,0,0,192,0,0,0,216,42,0,0,209,28,0,0,1,8,0,0,85,29,0,0,117,13,0,0,167,29,0,0,193,19,0,0,249,23,0,0,84,19,0,0,192,6,0,0,144,1,0,0,59,14,0,0,218,26,0,0,248,23,0,0,27,25,0,0,195,7,0,0,91,41,0,0,115,45,0,0,20,34,0,0,201,47,0,0,130,35,0,0,153,21,0,0,171,27,0,0,79,5,0,0,59,21,0,0,52,44,0,0,230,4,0,0,218,32,0,0,127,40,0,0,158,15,0,0,16,40,0,0,126,14,0,0,205,23,0,0,70,21,0,0,38,27,0,0,60,1,0,0,131,46,0,0,109,32,0,0,45,46,0,0,220,24,0,0,250,3,0,0,17,4,0,0,71,34,0,0,40,9,0,0,3,43,0,0,198,21,0,0,181,7,0,0,67,35,0,0,42,28,0,0,247,45,0,0,136,39,0,0,52,19,0,0,228,16,0,0,195,20,0,0,235,15,0,0,115,17,0,0,181,18,0,0,161,21,0,0,116,29,0,0,160,30,0,0,80,21,0,0,147,0,0,0,205,14,0,0,230,23,0,0,23,33,0,0,166,4,0,0,134,37,0,0,20,15,0,0,69,21,0,0,73,30,0,0,231,43,0,0,103,44,0,0,72,46,0,0,34,4,0,0,18,32,0,0,169,43,0,0,227,39,0,0,31,31,0,0,166,7,0,0,179,35,0,0,39,5,0,0,197,2,0,0,51,32,0,0,80,24,0,0,190,44,0,0,15,34,0,0,113,31,0,0,193,47,0,0,185,33,0,0,102,38,0,0,86,45,0,0,58,38,0,0,132,11,0,0,30,6,0,0,107,25,0,0,110,21,0,0,19,36,0,0,206,35,0,0,46,41,0,0,137,20,0,0,250,14,0,0,176,30,0,0,226,24,0,0,0,35,0,0,55,31,0,0,168,0,0,0,125,37,0,0,184,24,0,0,242,19,0,0,170,7,0,0,199,41,0,0,23,24,0,0,6,38,0,0,193,27,0,0,81,43,0,0,80,5,0,0,116,15,0,0,26,24,0,0,177,20,0,0,133,42,0,0,188,46,0,0,77,44,0,0,122,4,0,0,135,4,0,0,155,24,0,0,48,32,0,0,144,14,0,0,20,32,0,0,81,32,0,0,103,11,0,0,79,33,0,0,117,45,0,0,134,22,0,0,39,1,0,0,211,23,0,0,64,36,0,0,157,6,0,0,174,0,0,0,211,2,0,0,154,25,0,0,95,10,0,0,21,25,0,0,178,10,0,0,243,12,0,0,170,1,0,0,191,40,0,0,111,29,0,0,166,46,0,0,148,36,0,0,173,14,0,0,74,40,0,0,9,8,0,0,249,20,0,0,116,30,0,0,127,35,0,0,250,26,0,0,234,40,0,0,232,5,0,0,94,1,0,0,203,5,0,0,230,24,0,0,208,47,0,0,18,43,0,0,203,24,0,0,47,6,0,0,196,9,0,0,209,5,0,0,44,27,0,0,18,40,0,0,233,8,0,0,244,22,0,0,151,15,0,0,128,32,0,0,50,37,0,0,156,0,0,0,13,5,0,0,129,18,0,0,204,26,0,0,166,18,0,0,69,33,0,0,95,46,0,0,237,24,0,0,197,1,0,0,66,11,0,0,13,7,0,0,3,8,0,0,162,7,0,0,193,45,0,0,123,15,0,0,143,9,0,0,254,23,0,0,19,16,0,0,43,36,0,0,206,40,0,0,200,38,0,0,218,0,0,0,165,36,0,0,56,34,0,0,151,34,0,0,70,5,0,0,57,25,0,0,26,33,0,0,198,6,0,0,186,30,0,0,29,15,0,0,250,5,0,0,99,41,0,0,2,43,0,0,160,44,0,0,207,27,0,0,112,10,0,0,96,39,0,0,30,41,0,0,189,0,0,0,44,12,0,0,136,4,0,0,212,18,0,0,22,12,0,0,91,30,0,0,52,39,0,0,76,7,0,0,35,21,0,0,87,37,0,0,159,31,0,0,54,36,0,0,24,11,0,0,174,9,0,0,213,17,0,0,147,28,0,0,214,19,0,0,10,41,0,0,174,37,0,0,71,4,0,0,28,36,0,0,149,22,0,0,3,32,0,0,134,34,0,0,26,17,0,0,217,4,0,0,105,37,0,0,226,18,0,0,1,31,0,0,245,36,0,0,185,47,0,0,240,31,0,0,50,7,0,0,0,15,0,0,102,27,0,0,3,41,0,0,30,43,0,0,223,26,0,0,243,7,0,0,16,4,0,0,167,40,0,0,20,24,0,0,162,18,0,0,81,44,0,0,90,27,0,0,85,14,0,0,41,22,0,0,204,11,0,0,30,21,0,0,57,18,0,0,6,15,0,0,37,6,0,0,175,23,0,0,209,14,0,0,3,28,0,0,11,46,0,0,109,7,0,0,42,10,0,0,81,23,0,0,216,29,0,0,138,23,0,0,144,36,0,0,145,6,0,0,20,33,0,0,6,4,0,0,210,1,0,0,96,4,0,0,231,9,0,0,21,0,0,0,176,22,0,0,23,3,0,0,127,38,0,0,246,36,0,0,57,11,0,0,3,9,0,0,193,16,0,0,121,45,0,0,107,47,0,0,170,0,0,0,239,25,0,0,4,39,0,0,151,44,0,0,141,11,0,0,201,5,0,0,133,36,0,0,3,40,0,0,118,47,0,0,253,34,0,0,228,9,0,0,245,12,0,0,119,34,0,0,165,6,0,0,89,18,0,0,7,34,0,0,10,3,0,0,152,17,0,0,66,10,0,0,239,45,0,0,249,47,0,0,56,46,0,0,205,16,0,0,171,17,0,0,200,40,0,0,113,25,0,0,196,12,0,0,46,33,0,0,174,14,0,0,131,34,0,0,122,16,0,0,38,17,0,0,146,44,0,0,224,37,0,0,214,3,0,0,29,39,0,0,136,3,0,0,181,9,0,0,171,21,0,0,175,19,0,0,24,0,0,0,91,5,0,0,155,45,0,0,1,43,0,0,85,21,0,0,127,36,0,0,77,10,0,0,99,30,0,0,247,3,0,0,122,40,0,0,148,46,0,0,144,44,0,0,203,41,0,0,59,17,0,0,227,38,0,0,58,43,0,0,158,40,0,0,18,28,0,0,247,40,0,0,238,41,0,0,90,13,0,0,166,30,0,0,116,34,0,0,250,23,0,0,161,1,0,0,12,39,0,0,85,18,0,0,34,9,0,0,118,5,0,0,239,35,0,0,78,28,0,0,199,44,0,0,15,26,0,0,122,6,0,0,100,25,0,0,83,34,0,0,239,2,0,0,146,29,0,0,245,24,0,0,142,3,0,0,249,11,0,0,226,5,0,0,186,25,0,0,131,17,0,0,195,37,0,0,247,26,0,0,3,46,0,0,53,18,0,0,248,20,0,0,191,45,0,0,152,7,0,0,194,1,0,0,225,34,0,0,76,18,0,0,194,47,0,0,242,27,0,0,188,38,0,0,134,28,0,0,33,33,0,0,86,14,0,0,132,36,0,0,202,45,0,0,227,25,0,0,169,20,0,0,253,14,0,0,35,10,0,0,149,12,0,0,177,16,0,0,47,32,0,0,87,20,0,0,181,44,0,0,175,27,0,0,212,3,0,0,170,2,0,0,19,30,0,0,218,19,0,0,28,27,0,0,128,36,0,0,131,42,0,0,73,10,0,0,37,1,0,0,97,35,0,0,185,14,0,0,247,18,0,0,105,34,0,0,134,39,0,0,191,11,0,0,241,4,0,0,103,26,0,0,29,26,0,0,153,32,0,0,254,31,0,0,0,45,0,0,107,26,0,0,216,0,0,0,50,0,0,0,200,31,0,0,92,39,0,0,255,2,0,0,36,33,0,0,249,30,0,0,44,35,0,0,175,35,0,0,67,28,0,0,250,47,0,0,113,40,0,0,180,44,0,0,118,33,0,0,170,6,0,0,168,32,0,0,135,29,0,0,157,12,0,0,28,40,0,0,16,11,0,0,244,13,0,0,2,5,0,0,208,13,0,0,250,20,0,0,169,14,0,0,101,15,0,0,40,24,0,0,209,35,0,0,14,22,0,0,198,23,0,0,251,39,0,0,179,9,0,0,64,5,0,0,226,11,0,0,188,5,0,0,141,15,0,0,79,13,0,0,50,46,0,0,180,0,0,0,42,16,0,0,4,30,0,0,129,10,0,0,128,42,0,0,158,27,0,0,204,0,0,0,133,21,0,0,33,4,0,0,217,37,0,0,97,18,0,0,208,35,0,0,56,36,0,0,212,4,0,0,123,17,0,0,126,20,0,0,155,16,0,0,131,18,0,0,55,43,0,0,115,26,0,0,161,27,0,0,45,36,0,0,56,9,0,0,149,46,0,0,1,46,0,0,195,29,0,0,42,19,0,0,169,26,0,0,202,17,0,0,31,44,0,0,239,0,0,0,84,11,0,0,109,27,0,0,146,0,0,0,107,46,0,0,106,41,0,0,69,20,0,0,206,23,0,0,123,5,0,0,12,7,0,0,147,45,0,0,56,41,0,0,40,22,0,0,147,17,0,0,124,2,0,0,233,21,0,0,115,32,0,0,131,11,0,0,65,13,0,0,18,31,0,0,243,8,0,0,47,13,0,0,16,33,0,0,139,16,0,0,57,34,0,0,208,28,0,0,92,25,0,0,138,32,0,0,71,23,0,0,157,39,0,0,182,28,0,0,251,19,0,0,138,9,0,0,224,4,0,0,104,40,0,0,5,4,0,0,92,22,0,0,45,5,0,0,35,26,0,0,241,34,0,0,100,7,0,0,40,14,0,0,15,42,0,0,103,8,0,0,23,16,0,0,15,13,0,0,1,30,0,0,214,27,0,0,119,28,0,0,237,47,0,0,150,32,0,0,82,1,0,0,106,38,0,0,58,22,0,0,208,6,0,0,34,5,0,0,187,33,0,0,179,36,0,0,71,16,0,0,197,23,0,0,155,3,0,0,243,43,0,0,204,23,0,0,74,39,0,0,64,47,0,0,240,10,0,0,88,46,0,0,44,7,0,0,121,46,0,0,137,8,0,0,84,6,0,0,119,1,0,0,31,30,0,0,136,46,0,0,150,7,0,0,80,13,0,0,242,37,0,0,116,43,0,0,41,37,0,0,154,4,0,0,102,21,0,0,74,34,0,0,204,12,0,0,247,34,0,0,164,8,0,0,143,37,0,0,112,5,0,0,152,22,0,0,231,4,0,0,7,46,0,0,220,6,0,0,208,31,0,0,136,32,0,0,51,34,0,0,63,25,0,0,17,8,0,0,45,30,0,0,167,13,0,0,19,42,0,0,76,33,0,0,177,31,0,0,58,28,0,0,157,9,0,0,30,39,0,0,21,22,0,0,86,31,0,0,150,43,0,0,165,5,0,0,5,29,0,0,156,43,0,0,251,4,0,0,125,26,0,0,152,4,0,0,102,22,0,0,45,47,0,0,179,24,0,0,48,37,0,0,42,12,0,0,158,24,0,0,37,26,0,0,67,2,0,0,49,15,0,0,120,42,0,0,213,25,0,0,153,17,0,0,48,39,0,0,203,22,0,0,242,35,0,0,238,28,0,0,122,32,0,0,238,19,0,0,101,46,0,0,45,26,0,0,44,25,0,0,224,9,0,0,17,36,0,0,99,19,0,0,97,33,0,0,23,14,0,0,210,42,0,0,145,27,0,0,155,32,0,0,65,46,0,0,11,44,0,0,197,28,0,0,84,29,0,0,214,17,0,0,204,22,0,0,189,47,0,0,212,8,0,0,255,5,0,0,128,12,0,0,157,10,0,0,60,0,0,0,142,16,0,0,157,45,0,0,131,16,0,0,40,13,0,0,229,45,0,0,132,47,0,0,246,5,0,0,126,16,0,0,18,24,0,0,232,18,0,0,65,32,0,0,91,12,0,0,205,30,0,0,90,1,0,0,20,8,0,0,109,5,0,0,189,43,0,0,89,20,0,0,31,13,0,0,124,35,0,0,49,46,0,0,121,40,0,0,94,14,0,0,169,16,0,0,158,35,0,0,120,30,0,0,223,40,0,0,147,36,0,0,91,35,0,0,133,33,0,0,145,43,0,0,136,34,0,0,36,21,0,0,144,31,0,0,51,35,0,0,152,24,0,0,187,13,0,0,75,46,0,0,194,4,0,0,197,19,0,0,0,6,0,0,185,6,0,0,132,38,0,0,7,16,0,0,164,42,0,0,166,11,0,0,52,45,0,0,5,14,0,0,111,38,0,0,88,41,0,0,211,44,0,0,97,46,0,0,62,8,0,0,204,2,0,0,40,21,0,0,116,8,0,0,74,7,0,0,91,20,0,0,138,29,0,0,73,43,0,0,141,40,0,0,71,30,0,0,170,46,0,0,120,13,0,0,0,8,0,0,0,4,0,0,123,32,114,101,116,117,114,110,32,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,40,41,59,32,125,0,123,32,105,102,32,40,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,32,61,61,61,32,117,110,100,101,102,105,110,101,100,41,32,123,32,116,114,121,32,123,32,118,97,114,32,119,105,110,100,111,119,95,32,61,32,34,111,98,106,101,99,116,34,32,61,61,61,32,116,121,112,101,111,102,32,119,105,110,100,111,119,32,63,32,119,105,110,100,111,119,32,58,32,115,101,108,102,44,32,99,114,121,112,116,111,95,32,61,32,116,121,112,101,111,102,32,119,105,110,100,111,119,95,46,99,114,121,112,116,111,32,33,61,61,32,34,117,110,100,101,102,105,110,101,100,34,32,63,32,119,105,110,100,111,119,95,46,99,114,121,112,116,111,32,58,32,119,105,110,100,111,119,95,46,109,115,67,114,121,112,116,111,44,32,114,97,110,100,111,109,86,97,108,117,101,115,83,116,97,110,100,97,114,100,32,61,32,102,117,110,99,116,105,111,110,40,41,32,123,32,118,97,114,32,98,117,102,32,61,32,110,101,119,32,85,105,110,116,51,50,65,114,114,97,121,40,49,41,59,32,99,114,121,112,116,111,95,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,115,40,98,117,102,41,59,32,114,101,116,117,114,110,32,98,117,102,91,48,93,32,62,62,62,32,48,59,32,125,59,32,114,97,110,100,111,109,86,97,108,117,101,115,83,116,97,110,100,97,114,100,40,41,59,32,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,32,61,32,114,97,110,100,111,109,86,97,108,117,101,115,83,116,97,110,100,97,114,100,59,32,125,32,99,97,116,99,104,32,40,101,41,32,123,32,116,114,121,32,123,32,118,97,114,32,99,114,121,112,116,111,32,61,32,114,101,113,117,105,114,101,40,39,99,114,121,112,116,111,39,41,44,32,114,97,110,100,111,109,86,97,108,117,101,78,111,100,101,74,83,32,61,32,102,117,110,99,116,105,111,110,40,41,32,123,32,118,97,114,32,98,117,102,32,61,32,99,114,121,112,116,111,46,114,97,110,100,111,109,66,121,116,101,115,40,52,41,59,32,114,101,116,117,114,110,32,40,98,117,102,91,48,93,32,60,60,32,50,52,32,124,32,98,117,102,91,49,93,32,60,60,32,49,54,32,124,32,98,117,102,91,50,93,32,60,60,32,56,32,124,32,98,117,102,91,51,93,41,32,62,62,62,32,48,59,32,125,59,32,114,97,110,100,111,109,86,97,108,117,101,78,111,100,101,74,83,40,41,59,32,77,111,100,117,108,101,46,103,101,116,82,97,110,100,111,109,86,97,108,117,101,32,61,32,114,97,110,100,111,109,86,97,108,117,101,78,111,100,101,74,83,59,32,125,32,99,97,116,99,104,32,40,101,41,32,123,32,116,104,114,111,119,32,39,78,111,32,115,101,99,117,114,101,32,114,97,110,100,111,109,32,110,117,109,98,101,114,32,103,101,110,101,114,97,116,111,114,32,102,111,117,110,100,39,59,32,125,32,125,32,125,32,125,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else Module.printErr('failed to set errno from JS');
      return value;
    }
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _sysconf(name) {
      // long sysconf(int name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
      switch(name) {
        case 30: return PAGE_SIZE;
        case 85: return totalMemory / PAGE_SIZE;
        case 132:
        case 133:
        case 12:
        case 137:
        case 138:
        case 15:
        case 235:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 149:
        case 13:
        case 10:
        case 236:
        case 153:
        case 9:
        case 21:
        case 22:
        case 159:
        case 154:
        case 14:
        case 77:
        case 78:
        case 139:
        case 80:
        case 81:
        case 82:
        case 68:
        case 67:
        case 164:
        case 11:
        case 29:
        case 47:
        case 48:
        case 95:
        case 52:
        case 51:
        case 46:
          return 200809;
        case 79:
          return 0;
        case 27:
        case 246:
        case 127:
        case 128:
        case 23:
        case 24:
        case 160:
        case 161:
        case 181:
        case 182:
        case 242:
        case 183:
        case 184:
        case 243:
        case 244:
        case 245:
        case 165:
        case 178:
        case 179:
        case 49:
        case 50:
        case 168:
        case 169:
        case 175:
        case 170:
        case 171:
        case 172:
        case 97:
        case 76:
        case 32:
        case 173:
        case 35:
          return -1;
        case 176:
        case 177:
        case 7:
        case 155:
        case 8:
        case 157:
        case 125:
        case 126:
        case 92:
        case 93:
        case 129:
        case 130:
        case 131:
        case 94:
        case 91:
          return 1;
        case 74:
        case 60:
        case 69:
        case 70:
        case 4:
          return 1024;
        case 31:
        case 42:
        case 72:
          return 32;
        case 87:
        case 26:
        case 33:
          return 2147483647;
        case 34:
        case 1:
          return 47839;
        case 38:
        case 36:
          return 99;
        case 43:
        case 37:
          return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 28: return 32768;
        case 44: return 32767;
        case 75: return 16384;
        case 39: return 1000;
        case 89: return 700;
        case 71: return 256;
        case 40: return 255;
        case 2: return 100;
        case 180: return 64;
        case 25: return 20;
        case 5: return 16;
        case 6: return 6;
        case 73: return 4;
        case 84: {
          if (typeof navigator === 'object') return navigator['hardwareConcurrency'] || 1;
          return 1;
        }
      }
      ___setErrNo(ERRNO_CODES.EINVAL);
      return -1;
    }

   
  Module["_i64Subtract"] = _i64Subtract;

  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) {
        var success = self.alloc(bytes);
        if (!success) return -1 >>> 0; // sbrk failure code
      }
      return ret;  // Previous break location.
    }

   
  Module["_i64Add"] = _i64Add;

   
  Module["_bitshift64Ashr"] = _bitshift64Ashr;

   
  Module["_memset"] = _memset;

  var _emscripten_asm_const=true;

  var _emscripten_asm_const_int=true;

  function _abort() {
      Module['abort']();
    }

  function _time(ptr) {
      var ret = (Date.now()/1000)|0;
      if (ptr) {
        HEAP32[((ptr)>>2)]=ret;
      }
      return ret;
    }

  function _pthread_self() {
      //FIXME: assumes only a single thread
      return 0;
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

staticSealed = true; // seal the static portion of memory

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

 var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_DYNAMIC);


var debug_table_iiiiiiii = ["0", "jsCall_iiiiiiii_0", "jsCall_iiiiiiii_1", "jsCall_iiiiiiii_2", "jsCall_iiiiiiii_3", "jsCall_iiiiiiii_4", "jsCall_iiiiiiii_5", "jsCall_iiiiiiii_6", "jsCall_iiiiiiii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_stream_ietf_ref_xor_ic", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
var debug_table_iiiiii = ["0", "jsCall_iiiiii_0", "jsCall_iiiiii_1", "jsCall_iiiiii_2", "jsCall_iiiiii_3", "jsCall_iiiiii_4", "jsCall_iiiiii_5", "jsCall_iiiiii_6", "jsCall_iiiiii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_stream_ref", "_stream_ietf_ref", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
var debug_table_iiiiiii = ["0", "jsCall_iiiiiii_0", "jsCall_iiiiiii_1", "jsCall_iiiiiii_2", "jsCall_iiiiiii_3", "jsCall_iiiiiii_4", "jsCall_iiiiiii_5", "jsCall_iiiiiii_6", "jsCall_iiiiiii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_rlwejs_streamoutput", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
var debug_table_iiiii = ["0", "jsCall_iiiii_0", "jsCall_iiiii_1", "jsCall_iiiii_2", "jsCall_iiiii_3", "jsCall_iiiii_4", "jsCall_iiiii_5", "jsCall_iiiii_6", "jsCall_iiiii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_rlwejs_extendableoutput", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
var debug_table_iiiiiiiii = ["0", "jsCall_iiiiiiiii_0", "jsCall_iiiiiiiii_1", "jsCall_iiiiiiiii_2", "jsCall_iiiiiiiii_3", "jsCall_iiiiiiiii_4", "jsCall_iiiiiiiii_5", "jsCall_iiiiiiiii_6", "jsCall_iiiiiiiii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_stream_ref_xor_ic", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
var debug_table_iii = ["0", "jsCall_iii_0", "jsCall_iii_1", "jsCall_iii_2", "jsCall_iii_3", "jsCall_iii_4", "jsCall_iii_5", "jsCall_iii_6", "jsCall_iii_7", "0", "0", "0", "0", "0", "0", "0", "0", "0", "_rlwejs_randombytes", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"];
function nullFunc_iiiiiiii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiii: " + debug_table_iiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  "); abort(x) }

function nullFunc_iiiiii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiii: " + debug_table_iiiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  "); abort(x) }

function nullFunc_iiiiiii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  "); abort(x) }

function nullFunc_iiiii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiiiii: " + debug_table_iiiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  "); abort(x) }

function nullFunc_iiiiiiiii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iiiiiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iii: " + debug_table_iii[x] + "  iiiiiii: " + debug_table_iiiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  "); abort(x) }

function nullFunc_iii(x) { Module["printErr"]("Invalid function pointer '" + x + "' called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("This pointer might make sense in another type signature: iiiii: " + debug_table_iiiii[x] + "  iiiiii: " + debug_table_iiiiii[x] + "  iiiiiii: " + debug_table_iiiiiii[x] + "  iiiiiiii: " + debug_table_iiiiiiii[x] + "  iiiiiiiii: " + debug_table_iiiiiiiii[x] + "  "); abort(x) }

function invoke_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  try {
    return Module["dynCall_iiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
    return Runtime.functionPointers[index](a1,a2,a3,a4,a5,a6,a7);
}

function invoke_iiiiii(index,a1,a2,a3,a4,a5) {
  try {
    return Module["dynCall_iiiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iiiiii(index,a1,a2,a3,a4,a5) {
    return Runtime.functionPointers[index](a1,a2,a3,a4,a5);
}

function invoke_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    return Module["dynCall_iiiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
    return Runtime.functionPointers[index](a1,a2,a3,a4,a5,a6);
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iiiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iiiii(index,a1,a2,a3,a4) {
    return Runtime.functionPointers[index](a1,a2,a3,a4);
}

function invoke_iiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
  try {
    return Module["dynCall_iiiiiiiii"](index,a1,a2,a3,a4,a5,a6,a7,a8);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
    return Runtime.functionPointers[index](a1,a2,a3,a4,a5,a6,a7,a8);
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function jsCall_iii(index,a1,a2) {
    return Runtime.functionPointers[index](a1,a2);
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "nullFunc_iiiiiiii": nullFunc_iiiiiiii, "nullFunc_iiiiii": nullFunc_iiiiii, "nullFunc_iiiiiii": nullFunc_iiiiiii, "nullFunc_iiiii": nullFunc_iiiii, "nullFunc_iiiiiiiii": nullFunc_iiiiiiiii, "nullFunc_iii": nullFunc_iii, "invoke_iiiiiiii": invoke_iiiiiiii, "jsCall_iiiiiiii": jsCall_iiiiiiii, "invoke_iiiiii": invoke_iiiiii, "jsCall_iiiiii": jsCall_iiiiii, "invoke_iiiiiii": invoke_iiiiiii, "jsCall_iiiiiii": jsCall_iiiiiii, "invoke_iiiii": invoke_iiiii, "jsCall_iiiii": jsCall_iiiii, "invoke_iiiiiiiii": invoke_iiiiiiiii, "jsCall_iiiiiiiii": jsCall_iiiiiiiii, "invoke_iii": invoke_iii, "jsCall_iii": jsCall_iii, "_emscripten_asm_const_i": _emscripten_asm_const_i, "_pthread_self": _pthread_self, "_abort": _abort, "___setErrNo": ___setErrNo, "_sbrk": _sbrk, "_time": _time, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_emscripten_asm_const_v": _emscripten_asm_const_v, "_sysconf": _sysconf, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8 };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'almost asm';
  
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;

  var tempRet0 = 0;
  var tempRet1 = 0;
  var tempRet2 = 0;
  var tempRet3 = 0;
  var tempRet4 = 0;
  var tempRet5 = 0;
  var tempRet6 = 0;
  var tempRet7 = 0;
  var tempRet8 = 0;
  var tempRet9 = 0;
  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var nullFunc_iiiiiiii=env.nullFunc_iiiiiiii;
  var nullFunc_iiiiii=env.nullFunc_iiiiii;
  var nullFunc_iiiiiii=env.nullFunc_iiiiiii;
  var nullFunc_iiiii=env.nullFunc_iiiii;
  var nullFunc_iiiiiiiii=env.nullFunc_iiiiiiiii;
  var nullFunc_iii=env.nullFunc_iii;
  var invoke_iiiiiiii=env.invoke_iiiiiiii;
  var jsCall_iiiiiiii=env.jsCall_iiiiiiii;
  var invoke_iiiiii=env.invoke_iiiiii;
  var jsCall_iiiiii=env.jsCall_iiiiii;
  var invoke_iiiiiii=env.invoke_iiiiiii;
  var jsCall_iiiiiii=env.jsCall_iiiiiii;
  var invoke_iiiii=env.invoke_iiiii;
  var jsCall_iiiii=env.jsCall_iiiii;
  var invoke_iiiiiiiii=env.invoke_iiiiiiiii;
  var jsCall_iiiiiiiii=env.jsCall_iiiiiiiii;
  var invoke_iii=env.invoke_iii;
  var jsCall_iii=env.jsCall_iii;
  var _emscripten_asm_const_i=env._emscripten_asm_const_i;
  var _pthread_self=env._pthread_self;
  var _abort=env._abort;
  var ___setErrNo=env.___setErrNo;
  var _sbrk=env._sbrk;
  var _time=env._time;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var _emscripten_asm_const_v=env._emscripten_asm_const_v;
  var _sysconf=env._sysconf;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
if ((STACKTOP|0) >= (STACK_MAX|0)) abort();

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}
function copyTempFloat(ptr) {
  ptr = ptr|0;
  HEAP8[tempDoublePtr>>0] = HEAP8[ptr>>0];
  HEAP8[tempDoublePtr+1>>0] = HEAP8[ptr+1>>0];
  HEAP8[tempDoublePtr+2>>0] = HEAP8[ptr+2>>0];
  HEAP8[tempDoublePtr+3>>0] = HEAP8[ptr+3>>0];
}
function copyTempDouble(ptr) {
  ptr = ptr|0;
  HEAP8[tempDoublePtr>>0] = HEAP8[ptr>>0];
  HEAP8[tempDoublePtr+1>>0] = HEAP8[ptr+1>>0];
  HEAP8[tempDoublePtr+2>>0] = HEAP8[ptr+2>>0];
  HEAP8[tempDoublePtr+3>>0] = HEAP8[ptr+3>>0];
  HEAP8[tempDoublePtr+4>>0] = HEAP8[ptr+4>>0];
  HEAP8[tempDoublePtr+5>>0] = HEAP8[ptr+5>>0];
  HEAP8[tempDoublePtr+6>>0] = HEAP8[ptr+6>>0];
  HEAP8[tempDoublePtr+7>>0] = HEAP8[ptr+7>>0];
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _sodium_memzero($pnt,$len) {
 $pnt = $pnt|0;
 $len = $len|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $pnt_ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pnt;
 $1 = $len;
 $2 = $0; //@line 89 "libsodium/src/libsodium/sodium/utils.c"
 $pnt_ = $2; //@line 88 "libsodium/src/libsodium/sodium/utils.c"
 $i = 0; //@line 90 "libsodium/src/libsodium/sodium/utils.c"
 while(1) {
  $3 = $i; //@line 92 "libsodium/src/libsodium/sodium/utils.c"
  $4 = $1; //@line 92 "libsodium/src/libsodium/sodium/utils.c"
  $5 = ($3>>>0)<($4>>>0); //@line 92 "libsodium/src/libsodium/sodium/utils.c"
  if (!($5)) {
   break;
  }
  $6 = $i; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $7 = (($6) + 1)|0; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $i = $7; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $8 = $pnt_; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  $9 = (($8) + ($6)|0); //@line 93 "libsodium/src/libsodium/sodium/utils.c"
  HEAP8[$9>>0] = 0; //@line 93 "libsodium/src/libsodium/sodium/utils.c"
 }
 STACKTOP = sp;return; //@line 96 "libsodium/src/libsodium/sodium/utils.c"
}
function _randombytes_random() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = _emscripten_asm_const_i(0)|0; //@line 70 "libsodium/src/libsodium/randombytes/randombytes.c"
 return ($0|0); //@line 70 "libsodium/src/libsodium/randombytes/randombytes.c"
}
function _randombytes_stir() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 _emscripten_asm_const_v(1); //@line 85 "libsodium/src/libsodium/randombytes/randombytes.c"
 return; //@line 113 "libsodium/src/libsodium/randombytes/randombytes.c"
}
function _randombytes_buf($buf,$size) {
 $buf = $buf|0;
 $size = $size|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $p = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $buf;
 $1 = $size;
 $2 = $0; //@line 151 "libsodium/src/libsodium/randombytes/randombytes.c"
 $p = $2; //@line 151 "libsodium/src/libsodium/randombytes/randombytes.c"
 $i = 0; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
 while(1) {
  $3 = $i; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $4 = $1; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $5 = ($3>>>0)<($4>>>0); //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  if (!($5)) {
   break;
  }
  $6 = (_randombytes_random()|0); //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $7 = $6&255; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $8 = $i; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $9 = $p; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $10 = (($9) + ($8)|0); //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  HEAP8[$10>>0] = $7; //@line 155 "libsodium/src/libsodium/randombytes/randombytes.c"
  $11 = $i; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $12 = (($11) + 1)|0; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
  $i = $12; //@line 154 "libsodium/src/libsodium/randombytes/randombytes.c"
 }
 STACKTOP = sp;return; //@line 158 "libsodium/src/libsodium/randombytes/randombytes.c"
}
function _crypto_stream_chacha20($c,$0,$1,$n,$k) {
 $c = $c|0;
 $0 = $0|0;
 $1 = $1|0;
 $n = $n|0;
 $k = $k|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $3 = sp;
 $2 = $c;
 $6 = $3;
 $7 = $6;
 HEAP32[$7>>2] = $0;
 $8 = (($6) + 4)|0;
 $9 = $8;
 HEAP32[$9>>2] = $1;
 $4 = $n;
 $5 = $k;
 $10 = HEAP32[2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $11 = HEAP32[$10>>2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $12 = $2; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $13 = $3; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $14 = $13; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $15 = HEAP32[$14>>2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $16 = (($13) + 4)|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $17 = $16; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $18 = HEAP32[$17>>2]|0; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $19 = $4; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $20 = $5; //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 $21 = (FUNCTION_TABLE_iiiiii[$11 & 31]($12,$15,$18,$19,$20)|0); //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
 STACKTOP = sp;return ($21|0); //@line 31 "libsodium/src/libsodium/crypto_stream/chacha20/stream_chacha20.c"
}
function _stream_ref($c,$0,$1,$n,$k) {
 $c = $c|0;
 $0 = $0|0;
 $1 = $1|0;
 $n = $n|0;
 $k = $k|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $ctx = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $4 = sp;
 $ctx = sp + 8|0;
 $3 = $c;
 $7 = $4;
 $8 = $7;
 HEAP32[$8>>2] = $0;
 $9 = (($7) + 4)|0;
 $10 = $9;
 HEAP32[$10>>2] = $1;
 $5 = $n;
 $6 = $k;
 $11 = $4; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $12 = $11; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = HEAP32[$12>>2]|0; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = (($11) + 4)|0; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = $14; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = HEAP32[$15>>2]|0; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = ($13|0)!=(0); //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = ($16|0)!=(0); //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = $17 | $18; //@line 230 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($19) {
  $20 = $6; //@line 234 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($ctx,$20); //@line 234 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $21 = $5; //@line 235 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ivsetup($ctx,$21,0); //@line 235 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $22 = $3; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $23 = $4; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $24 = $23; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $25 = HEAP32[$24>>2]|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $26 = (($23) + 4)|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $27 = $26; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $28 = HEAP32[$27>>2]|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _memset(($22|0),0,($25|0))|0; //@line 236 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $29 = $3; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $30 = $3; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $31 = $4; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $32 = $31; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = HEAP32[$32>>2]|0; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $34 = (($31) + 4)|0; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $35 = $34; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $36 = HEAP32[$35>>2]|0; //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($ctx,$29,$30,$33,$36); //@line 237 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($ctx,64); //@line 238 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $2 = 0; //@line 240 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = $2; //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($37|0); //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $2 = 0; //@line 231 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = $2; //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($37|0); //@line 241 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _chacha_keysetup($ctx,$k) {
 $ctx = $ctx|0;
 $k = $k|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ctx;
 $1 = $k;
 $2 = $0; //@line 50 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$2>>2] = 1634760805; //@line 50 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $3 = $0; //@line 51 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $4 = ((($3)) + 4|0); //@line 51 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$4>>2] = 857760878; //@line 51 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $5 = $0; //@line 52 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $6 = ((($5)) + 8|0); //@line 52 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$6>>2] = 2036477234; //@line 52 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $7 = $0; //@line 53 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $8 = ((($7)) + 12|0); //@line 53 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$8>>2] = 1797285236; //@line 53 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $9 = $1; //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $10 = (_load32_le($9)|0); //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $11 = $0; //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $12 = ((($11)) + 16|0); //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$12>>2] = $10; //@line 54 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = $1; //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = ((($13)) + 4|0); //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = (_load32_le($14)|0); //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = $0; //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = ((($16)) + 20|0); //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$17>>2] = $15; //@line 55 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = $1; //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = ((($18)) + 8|0); //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = (_load32_le($19)|0); //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = $0; //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = ((($21)) + 24|0); //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$22>>2] = $20; //@line 56 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = $1; //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = ((($23)) + 12|0); //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = (_load32_le($24)|0); //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = $0; //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $27 = ((($26)) + 28|0); //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$27>>2] = $25; //@line 57 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $28 = $1; //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $29 = ((($28)) + 16|0); //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $30 = (_load32_le($29)|0); //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $31 = $0; //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $32 = ((($31)) + 32|0); //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$32>>2] = $30; //@line 58 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $33 = $1; //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $34 = ((($33)) + 20|0); //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $35 = (_load32_le($34)|0); //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $36 = $0; //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $37 = ((($36)) + 36|0); //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$37>>2] = $35; //@line 59 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $38 = $1; //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $39 = ((($38)) + 24|0); //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $40 = (_load32_le($39)|0); //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $41 = $0; //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $42 = ((($41)) + 40|0); //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$42>>2] = $40; //@line 60 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $43 = $1; //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $44 = ((($43)) + 28|0); //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $45 = (_load32_le($44)|0); //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $46 = $0; //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $47 = ((($46)) + 44|0); //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$47>>2] = $45; //@line 61 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 62 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _load32_le($src) {
 $src = $src|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $w = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $src;
 $1 = $0; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $2 = HEAP8[$1>>0]|0; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $3 = $2&255; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $w = $3; //@line 56 "libsodium/src/libsodium/include/sodium/private/common.h"
 $4 = $0; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $5 = ((($4)) + 1|0); //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $6 = HEAP8[$5>>0]|0; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $7 = $6&255; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $8 = $7 << 8; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $9 = $w; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $10 = $9 | $8; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $w = $10; //@line 57 "libsodium/src/libsodium/include/sodium/private/common.h"
 $11 = $0; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $12 = ((($11)) + 2|0); //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $13 = HEAP8[$12>>0]|0; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $14 = $13&255; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $15 = $14 << 16; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $16 = $w; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $17 = $16 | $15; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $w = $17; //@line 58 "libsodium/src/libsodium/include/sodium/private/common.h"
 $18 = $0; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $19 = ((($18)) + 3|0); //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $20 = HEAP8[$19>>0]|0; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $21 = $20&255; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $22 = $21 << 24; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $23 = $w; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $24 = $23 | $22; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $w = $24; //@line 59 "libsodium/src/libsodium/include/sodium/private/common.h"
 $25 = $w; //@line 60 "libsodium/src/libsodium/include/sodium/private/common.h"
 STACKTOP = sp;return ($25|0); //@line 60 "libsodium/src/libsodium/include/sodium/private/common.h"
}
function _chacha_ivsetup($ctx,$iv,$counter) {
 $ctx = $ctx|0;
 $iv = $iv|0;
 $counter = $counter|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ctx;
 $1 = $iv;
 $2 = $counter;
 $3 = $2; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $4 = ($3|0)==(0|0); //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($4) {
  $9 = 0;
 } else {
  $5 = $2; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $6 = (_load32_le($5)|0); //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $9 = $6;
 }
 $7 = $0; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $8 = ((($7)) + 48|0); //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$8>>2] = $9; //@line 67 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $10 = $2; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $11 = ($10|0)==(0|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($11) {
  $17 = 0;
 } else {
  $12 = $2; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $13 = ((($12)) + 4|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $14 = (_load32_le($13)|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $17 = $14;
 }
 $15 = $0; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = ((($15)) + 52|0); //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$16>>2] = $17; //@line 68 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = $1; //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = (_load32_le($18)|0); //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = $0; //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = ((($20)) + 56|0); //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$21>>2] = $19; //@line 69 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = $1; //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = ((($22)) + 4|0); //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = (_load32_le($23)|0); //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = $0; //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = ((($25)) + 60|0); //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$26>>2] = $24; //@line 70 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 71 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _chacha_encrypt_bytes($ctx,$m,$c,$0,$1) {
 $ctx = $ctx|0;
 $m = $m|0;
 $c = $c|0;
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0;
 var $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0;
 var $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0;
 var $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0;
 var $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0;
 var $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0;
 var $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0;
 var $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0;
 var $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0;
 var $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0;
 var $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0;
 var $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0;
 var $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0;
 var $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0;
 var $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0;
 var $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0;
 var $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0;
 var $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0;
 var $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0;
 var $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0;
 var $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0;
 var $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0;
 var $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0;
 var $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0;
 var $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0;
 var $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0;
 var $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0;
 var $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $ctarget = 0, $i = 0, $j0 = 0, $j1 = 0, $j10 = 0, $j11 = 0, $j12 = 0, $j13 = 0, $j14 = 0, $j15 = 0, $j2 = 0, $j3 = 0, $j4 = 0, $j5 = 0, $j6 = 0;
 var $j7 = 0, $j8 = 0, $j9 = 0, $tmp = 0, $x0 = 0, $x1 = 0, $x10 = 0, $x11 = 0, $x12 = 0, $x13 = 0, $x14 = 0, $x15 = 0, $x2 = 0, $x3 = 0, $x4 = 0, $x5 = 0, $x6 = 0, $x7 = 0, $x8 = 0, $x9 = 0;
 var dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $5 = sp;
 $tmp = sp + 160|0;
 $2 = $ctx;
 $3 = $m;
 $4 = $c;
 $6 = $5;
 $7 = $6;
 HEAP32[$7>>2] = $0;
 $8 = (($6) + 4)|0;
 $9 = $8;
 HEAP32[$9>>2] = $1;
 $ctarget = 0; //@line 87 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $10 = $5; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $11 = $10; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $12 = HEAP32[$11>>2]|0; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = (($10) + 4)|0; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = $13; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = HEAP32[$14>>2]|0; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = ($12|0)!=(0); //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = ($15|0)!=(0); //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = $16 | $17; //@line 91 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if (!($18)) {
  STACKTOP = sp;return; //@line 222 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 $19 = $5; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = $19; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = HEAP32[$20>>2]|0; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = (($19) + 4)|0; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = $22; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = HEAP32[$23>>2]|0; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = ($24>>>0)>(63); //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = ($21>>>0)>(4294967232); //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $27 = ($24|0)==(63); //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $28 = $27 & $26; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $29 = $25 | $28; //@line 94 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($29) {
  _abort(); //@line 95 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  // unreachable; //@line 95 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 $30 = $2; //@line 97 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $31 = HEAP32[$30>>2]|0; //@line 97 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j0 = $31; //@line 97 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $32 = $2; //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $33 = ((($32)) + 4|0); //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $34 = HEAP32[$33>>2]|0; //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j1 = $34; //@line 98 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $35 = $2; //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $36 = ((($35)) + 8|0); //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $37 = HEAP32[$36>>2]|0; //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j2 = $37; //@line 99 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $38 = $2; //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $39 = ((($38)) + 12|0); //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $40 = HEAP32[$39>>2]|0; //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j3 = $40; //@line 100 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $41 = $2; //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $42 = ((($41)) + 16|0); //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $43 = HEAP32[$42>>2]|0; //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j4 = $43; //@line 101 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $44 = $2; //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $45 = ((($44)) + 20|0); //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $46 = HEAP32[$45>>2]|0; //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j5 = $46; //@line 102 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $47 = $2; //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $48 = ((($47)) + 24|0); //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $49 = HEAP32[$48>>2]|0; //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j6 = $49; //@line 103 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $50 = $2; //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $51 = ((($50)) + 28|0); //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $52 = HEAP32[$51>>2]|0; //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j7 = $52; //@line 104 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $53 = $2; //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $54 = ((($53)) + 32|0); //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $55 = HEAP32[$54>>2]|0; //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j8 = $55; //@line 105 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $56 = $2; //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $57 = ((($56)) + 36|0); //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $58 = HEAP32[$57>>2]|0; //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j9 = $58; //@line 106 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $59 = $2; //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $60 = ((($59)) + 40|0); //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $61 = HEAP32[$60>>2]|0; //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j10 = $61; //@line 107 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $62 = $2; //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $63 = ((($62)) + 44|0); //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $64 = HEAP32[$63>>2]|0; //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j11 = $64; //@line 108 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $65 = $2; //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $66 = ((($65)) + 48|0); //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $67 = HEAP32[$66>>2]|0; //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j12 = $67; //@line 109 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $68 = $2; //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $69 = ((($68)) + 52|0); //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $70 = HEAP32[$69>>2]|0; //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j13 = $70; //@line 110 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $71 = $2; //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $72 = ((($71)) + 56|0); //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $73 = HEAP32[$72>>2]|0; //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j14 = $73; //@line 111 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $74 = $2; //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $75 = ((($74)) + 60|0); //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $76 = HEAP32[$75>>2]|0; //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $j15 = $76; //@line 112 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 while(1) {
  $77 = $5; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $78 = $77; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $79 = HEAP32[$78>>2]|0; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $80 = (($77) + 4)|0; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $81 = $80; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $82 = HEAP32[$81>>2]|0; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $83 = ($82>>>0)<(0); //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $84 = ($79>>>0)<(64); //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $85 = ($82|0)==(0); //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $86 = $85 & $84; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $87 = $83 | $86; //@line 115 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  if ($87) {
   dest=$tmp; stop=dest+64|0; do { HEAP8[dest>>0]=0|0; dest=dest+1|0; } while ((dest|0) < (stop|0)); //@line 116 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $i = 0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   while(1) {
    $88 = $i; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $89 = $5; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $90 = $89; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $91 = HEAP32[$90>>2]|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $92 = (($89) + 4)|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $93 = $92; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $94 = HEAP32[$93>>2]|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $95 = (0)<($94>>>0); //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $96 = ($88>>>0)<($91>>>0); //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $97 = (0)==($94|0); //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $98 = $97 & $96; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $99 = $95 | $98; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    if (!($99)) {
     break;
    }
    $100 = $i; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $101 = $3; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $102 = (($101) + ($100)|0); //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $103 = HEAP8[$102>>0]|0; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $104 = $i; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $105 = (($tmp) + ($104)|0); //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    HEAP8[$105>>0] = $103; //@line 118 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $106 = $i; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $107 = (($106) + 1)|0; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $i = $107; //@line 117 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   }
   $3 = $tmp; //@line 120 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $108 = $4; //@line 121 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $ctarget = $108; //@line 121 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $4 = $tmp; //@line 122 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  }
  $109 = $j0; //@line 124 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x0 = $109; //@line 124 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $110 = $j1; //@line 125 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x1 = $110; //@line 125 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $111 = $j2; //@line 126 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x2 = $111; //@line 126 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $112 = $j3; //@line 127 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x3 = $112; //@line 127 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $113 = $j4; //@line 128 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x4 = $113; //@line 128 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $114 = $j5; //@line 129 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x5 = $114; //@line 129 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $115 = $j6; //@line 130 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x6 = $115; //@line 130 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $116 = $j7; //@line 131 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x7 = $116; //@line 131 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $117 = $j8; //@line 132 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x8 = $117; //@line 132 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $118 = $j9; //@line 133 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x9 = $118; //@line 133 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $119 = $j10; //@line 134 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x10 = $119; //@line 134 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $120 = $j11; //@line 135 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x11 = $120; //@line 135 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $121 = $j12; //@line 136 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x12 = $121; //@line 136 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $122 = $j13; //@line 137 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x13 = $122; //@line 137 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $123 = $j14; //@line 138 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x14 = $123; //@line 138 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $124 = $j15; //@line 139 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x15 = $124; //@line 139 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $i = 20; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  while(1) {
   $125 = $i; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $126 = ($125>>>0)>(0); //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $127 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   if (!($126)) {
    break;
   }
   $128 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $129 = (($127) + ($128))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x0 = $129; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $130 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $131 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $132 = $130 ^ $131; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $133 = $132 << 16; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $134 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $135 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $136 = $134 ^ $135; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $137 = $136 >>> 16; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $138 = $133 | $137; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x12 = $138; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $139 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $140 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $141 = (($139) + ($140))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x8 = $141; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $142 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $143 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $144 = $142 ^ $143; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $145 = $144 << 12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $146 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $147 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $148 = $146 ^ $147; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $149 = $148 >>> 20; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $150 = $145 | $149; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x4 = $150; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $151 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $152 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $153 = (($151) + ($152))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x0 = $153; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $154 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $155 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $156 = $154 ^ $155; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $157 = $156 << 8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $158 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $159 = $x0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $160 = $158 ^ $159; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $161 = $160 >>> 24; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $162 = $157 | $161; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x12 = $162; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $163 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $164 = $x12; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $165 = (($163) + ($164))|0; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x8 = $165; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $166 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $167 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $168 = $166 ^ $167; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $169 = $168 << 7; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $170 = $x4; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $171 = $x8; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $172 = $170 ^ $171; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $173 = $172 >>> 25; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $174 = $169 | $173; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x4 = $174; //@line 141 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $175 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $176 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $177 = (($175) + ($176))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x1 = $177; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $178 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $179 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $180 = $178 ^ $179; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $181 = $180 << 16; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $182 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $183 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $184 = $182 ^ $183; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $185 = $184 >>> 16; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $186 = $181 | $185; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x13 = $186; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $187 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $188 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $189 = (($187) + ($188))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x9 = $189; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $190 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $191 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $192 = $190 ^ $191; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $193 = $192 << 12; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $194 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $195 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $196 = $194 ^ $195; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $197 = $196 >>> 20; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $198 = $193 | $197; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x5 = $198; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $199 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $200 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $201 = (($199) + ($200))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x1 = $201; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $202 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $203 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $204 = $202 ^ $203; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $205 = $204 << 8; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $206 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $207 = $x1; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $208 = $206 ^ $207; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $209 = $208 >>> 24; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $210 = $205 | $209; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x13 = $210; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $211 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $212 = $x13; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $213 = (($211) + ($212))|0; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x9 = $213; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $214 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $215 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $216 = $214 ^ $215; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $217 = $216 << 7; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $218 = $x5; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $219 = $x9; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $220 = $218 ^ $219; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $221 = $220 >>> 25; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $222 = $217 | $221; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x5 = $222; //@line 142 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $223 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $224 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $225 = (($223) + ($224))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x2 = $225; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $226 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $227 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $228 = $226 ^ $227; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $229 = $228 << 16; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $230 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $231 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $232 = $230 ^ $231; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $233 = $232 >>> 16; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $234 = $229 | $233; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x14 = $234; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $235 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $236 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $237 = (($235) + ($236))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x10 = $237; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $238 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $239 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $240 = $238 ^ $239; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $241 = $240 << 12; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $242 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $243 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $244 = $242 ^ $243; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $245 = $244 >>> 20; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $246 = $241 | $245; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x6 = $246; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $247 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $248 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $249 = (($247) + ($248))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x2 = $249; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $250 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $251 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $252 = $250 ^ $251; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $253 = $252 << 8; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $254 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $255 = $x2; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $256 = $254 ^ $255; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $257 = $256 >>> 24; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $258 = $253 | $257; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x14 = $258; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $259 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $260 = $x14; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $261 = (($259) + ($260))|0; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x10 = $261; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $262 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $263 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $264 = $262 ^ $263; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $265 = $264 << 7; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $266 = $x6; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $267 = $x10; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $268 = $266 ^ $267; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $269 = $268 >>> 25; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $270 = $265 | $269; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x6 = $270; //@line 143 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $271 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $272 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $273 = (($271) + ($272))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x3 = $273; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $274 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $275 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $276 = $274 ^ $275; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $277 = $276 << 16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $278 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $279 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $280 = $278 ^ $279; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $281 = $280 >>> 16; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $282 = $277 | $281; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x15 = $282; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $283 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $284 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $285 = (($283) + ($284))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x11 = $285; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $286 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $287 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $288 = $286 ^ $287; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $289 = $288 << 12; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $290 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $291 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $292 = $290 ^ $291; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $293 = $292 >>> 20; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $294 = $289 | $293; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x7 = $294; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $295 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $296 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $297 = (($295) + ($296))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x3 = $297; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $298 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $299 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $300 = $298 ^ $299; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $301 = $300 << 8; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $302 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $303 = $x3; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $304 = $302 ^ $303; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $305 = $304 >>> 24; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $306 = $301 | $305; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x15 = $306; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $307 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $308 = $x15; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $309 = (($307) + ($308))|0; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x11 = $309; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $310 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $311 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $312 = $310 ^ $311; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $313 = $312 << 7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $314 = $x7; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $315 = $x11; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $316 = $314 ^ $315; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $317 = $316 >>> 25; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $318 = $313 | $317; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x7 = $318; //@line 144 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $319 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $320 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $321 = (($319) + ($320))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x0 = $321; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $322 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $323 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $324 = $322 ^ $323; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $325 = $324 << 16; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $326 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $327 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $328 = $326 ^ $327; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $329 = $328 >>> 16; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $330 = $325 | $329; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x15 = $330; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $331 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $332 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $333 = (($331) + ($332))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x10 = $333; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $334 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $335 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $336 = $334 ^ $335; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $337 = $336 << 12; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $338 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $339 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $340 = $338 ^ $339; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $341 = $340 >>> 20; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $342 = $337 | $341; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x5 = $342; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $343 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $344 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $345 = (($343) + ($344))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x0 = $345; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $346 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $347 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $348 = $346 ^ $347; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $349 = $348 << 8; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $350 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $351 = $x0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $352 = $350 ^ $351; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $353 = $352 >>> 24; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $354 = $349 | $353; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x15 = $354; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $355 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $356 = $x15; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $357 = (($355) + ($356))|0; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x10 = $357; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $358 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $359 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $360 = $358 ^ $359; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $361 = $360 << 7; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $362 = $x5; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $363 = $x10; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $364 = $362 ^ $363; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $365 = $364 >>> 25; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $366 = $361 | $365; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x5 = $366; //@line 145 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $367 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $368 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $369 = (($367) + ($368))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x1 = $369; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $370 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $371 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $372 = $370 ^ $371; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $373 = $372 << 16; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $374 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $375 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $376 = $374 ^ $375; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $377 = $376 >>> 16; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $378 = $373 | $377; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x12 = $378; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $379 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $380 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $381 = (($379) + ($380))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x11 = $381; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $382 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $383 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $384 = $382 ^ $383; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $385 = $384 << 12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $386 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $387 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $388 = $386 ^ $387; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $389 = $388 >>> 20; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $390 = $385 | $389; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x6 = $390; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $391 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $392 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $393 = (($391) + ($392))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x1 = $393; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $394 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $395 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $396 = $394 ^ $395; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $397 = $396 << 8; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $398 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $399 = $x1; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $400 = $398 ^ $399; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $401 = $400 >>> 24; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $402 = $397 | $401; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x12 = $402; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $403 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $404 = $x12; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $405 = (($403) + ($404))|0; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x11 = $405; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $406 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $407 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $408 = $406 ^ $407; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $409 = $408 << 7; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $410 = $x6; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $411 = $x11; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $412 = $410 ^ $411; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $413 = $412 >>> 25; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $414 = $409 | $413; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x6 = $414; //@line 146 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $415 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $416 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $417 = (($415) + ($416))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x2 = $417; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $418 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $419 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $420 = $418 ^ $419; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $421 = $420 << 16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $422 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $423 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $424 = $422 ^ $423; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $425 = $424 >>> 16; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $426 = $421 | $425; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x13 = $426; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $427 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $428 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $429 = (($427) + ($428))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x8 = $429; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $430 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $431 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $432 = $430 ^ $431; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $433 = $432 << 12; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $434 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $435 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $436 = $434 ^ $435; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $437 = $436 >>> 20; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $438 = $433 | $437; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x7 = $438; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $439 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $440 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $441 = (($439) + ($440))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x2 = $441; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $442 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $443 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $444 = $442 ^ $443; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $445 = $444 << 8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $446 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $447 = $x2; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $448 = $446 ^ $447; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $449 = $448 >>> 24; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $450 = $445 | $449; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x13 = $450; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $451 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $452 = $x13; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $453 = (($451) + ($452))|0; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x8 = $453; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $454 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $455 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $456 = $454 ^ $455; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $457 = $456 << 7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $458 = $x7; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $459 = $x8; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $460 = $458 ^ $459; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $461 = $460 >>> 25; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $462 = $457 | $461; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x7 = $462; //@line 147 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $463 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $464 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $465 = (($463) + ($464))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x3 = $465; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $466 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $467 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $468 = $466 ^ $467; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $469 = $468 << 16; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $470 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $471 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $472 = $470 ^ $471; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $473 = $472 >>> 16; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $474 = $469 | $473; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x14 = $474; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $475 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $476 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $477 = (($475) + ($476))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x9 = $477; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $478 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $479 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $480 = $478 ^ $479; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $481 = $480 << 12; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $482 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $483 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $484 = $482 ^ $483; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $485 = $484 >>> 20; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $486 = $481 | $485; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x4 = $486; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $487 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $488 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $489 = (($487) + ($488))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x3 = $489; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $490 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $491 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $492 = $490 ^ $491; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $493 = $492 << 8; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $494 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $495 = $x3; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $496 = $494 ^ $495; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $497 = $496 >>> 24; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $498 = $493 | $497; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x14 = $498; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $499 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $500 = $x14; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $501 = (($499) + ($500))|0; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x9 = $501; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $502 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $503 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $504 = $502 ^ $503; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $505 = $504 << 7; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $506 = $x4; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $507 = $x9; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $508 = $506 ^ $507; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $509 = $508 >>> 25; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $510 = $505 | $509; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $x4 = $510; //@line 148 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $511 = $i; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $512 = (($511) - 2)|0; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $i = $512; //@line 140 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  }
  $513 = $j0; //@line 150 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $514 = (($127) + ($513))|0; //@line 150 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x0 = $514; //@line 150 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $515 = $x1; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $516 = $j1; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $517 = (($515) + ($516))|0; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x1 = $517; //@line 151 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $518 = $x2; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $519 = $j2; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $520 = (($518) + ($519))|0; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x2 = $520; //@line 152 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $521 = $x3; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $522 = $j3; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $523 = (($521) + ($522))|0; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x3 = $523; //@line 153 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $524 = $x4; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $525 = $j4; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $526 = (($524) + ($525))|0; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x4 = $526; //@line 154 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $527 = $x5; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $528 = $j5; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $529 = (($527) + ($528))|0; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x5 = $529; //@line 155 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $530 = $x6; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $531 = $j6; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $532 = (($530) + ($531))|0; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x6 = $532; //@line 156 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $533 = $x7; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $534 = $j7; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $535 = (($533) + ($534))|0; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x7 = $535; //@line 157 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $536 = $x8; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $537 = $j8; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $538 = (($536) + ($537))|0; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x8 = $538; //@line 158 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $539 = $x9; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $540 = $j9; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $541 = (($539) + ($540))|0; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x9 = $541; //@line 159 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $542 = $x10; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $543 = $j10; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $544 = (($542) + ($543))|0; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x10 = $544; //@line 160 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $545 = $x11; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $546 = $j11; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $547 = (($545) + ($546))|0; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x11 = $547; //@line 161 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $548 = $x12; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $549 = $j12; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $550 = (($548) + ($549))|0; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x12 = $550; //@line 162 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $551 = $x13; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $552 = $j13; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $553 = (($551) + ($552))|0; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x13 = $553; //@line 163 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $554 = $x14; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $555 = $j14; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $556 = (($554) + ($555))|0; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x14 = $556; //@line 164 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $557 = $x15; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $558 = $j15; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $559 = (($557) + ($558))|0; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x15 = $559; //@line 165 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $560 = $x0; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $561 = $3; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $562 = (_load32_le($561)|0); //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $563 = $560 ^ $562; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x0 = $563; //@line 167 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $564 = $x1; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $565 = $3; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $566 = ((($565)) + 4|0); //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $567 = (_load32_le($566)|0); //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $568 = $564 ^ $567; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x1 = $568; //@line 168 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $569 = $x2; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $570 = $3; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $571 = ((($570)) + 8|0); //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $572 = (_load32_le($571)|0); //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $573 = $569 ^ $572; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x2 = $573; //@line 169 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $574 = $x3; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $575 = $3; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $576 = ((($575)) + 12|0); //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $577 = (_load32_le($576)|0); //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $578 = $574 ^ $577; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x3 = $578; //@line 170 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $579 = $x4; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $580 = $3; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $581 = ((($580)) + 16|0); //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $582 = (_load32_le($581)|0); //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $583 = $579 ^ $582; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x4 = $583; //@line 171 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $584 = $x5; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $585 = $3; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $586 = ((($585)) + 20|0); //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $587 = (_load32_le($586)|0); //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $588 = $584 ^ $587; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x5 = $588; //@line 172 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $589 = $x6; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $590 = $3; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $591 = ((($590)) + 24|0); //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $592 = (_load32_le($591)|0); //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $593 = $589 ^ $592; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x6 = $593; //@line 173 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $594 = $x7; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $595 = $3; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $596 = ((($595)) + 28|0); //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $597 = (_load32_le($596)|0); //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $598 = $594 ^ $597; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x7 = $598; //@line 174 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $599 = $x8; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $600 = $3; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $601 = ((($600)) + 32|0); //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $602 = (_load32_le($601)|0); //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $603 = $599 ^ $602; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x8 = $603; //@line 175 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $604 = $x9; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $605 = $3; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $606 = ((($605)) + 36|0); //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $607 = (_load32_le($606)|0); //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $608 = $604 ^ $607; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x9 = $608; //@line 176 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $609 = $x10; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $610 = $3; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $611 = ((($610)) + 40|0); //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $612 = (_load32_le($611)|0); //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $613 = $609 ^ $612; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x10 = $613; //@line 177 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $614 = $x11; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $615 = $3; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $616 = ((($615)) + 44|0); //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $617 = (_load32_le($616)|0); //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $618 = $614 ^ $617; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x11 = $618; //@line 178 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $619 = $x12; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $620 = $3; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $621 = ((($620)) + 48|0); //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $622 = (_load32_le($621)|0); //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $623 = $619 ^ $622; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x12 = $623; //@line 179 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $624 = $x13; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $625 = $3; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $626 = ((($625)) + 52|0); //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $627 = (_load32_le($626)|0); //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $628 = $624 ^ $627; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x13 = $628; //@line 180 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $629 = $x14; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $630 = $3; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $631 = ((($630)) + 56|0); //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $632 = (_load32_le($631)|0); //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $633 = $629 ^ $632; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x14 = $633; //@line 181 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $634 = $x15; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $635 = $3; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $636 = ((($635)) + 60|0); //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $637 = (_load32_le($636)|0); //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $638 = $634 ^ $637; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $x15 = $638; //@line 182 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $639 = $j12; //@line 184 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $640 = (($639) + 1)|0; //@line 184 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $j12 = $640; //@line 184 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $641 = $j12; //@line 186 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $642 = ($641|0)!=(0); //@line 186 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  if (!($642)) {
   $643 = $j13; //@line 187 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $644 = (($643) + 1)|0; //@line 187 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   $j13 = $644; //@line 187 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  }
  $645 = $4; //@line 191 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $646 = $x0; //@line 191 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($645,$646); //@line 191 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $647 = $4; //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $648 = ((($647)) + 4|0); //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $649 = $x1; //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($648,$649); //@line 192 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $650 = $4; //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $651 = ((($650)) + 8|0); //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $652 = $x2; //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($651,$652); //@line 193 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $653 = $4; //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $654 = ((($653)) + 12|0); //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $655 = $x3; //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($654,$655); //@line 194 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $656 = $4; //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $657 = ((($656)) + 16|0); //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $658 = $x4; //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($657,$658); //@line 195 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $659 = $4; //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $660 = ((($659)) + 20|0); //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $661 = $x5; //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($660,$661); //@line 196 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $662 = $4; //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $663 = ((($662)) + 24|0); //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $664 = $x6; //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($663,$664); //@line 197 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $665 = $4; //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $666 = ((($665)) + 28|0); //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $667 = $x7; //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($666,$667); //@line 198 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $668 = $4; //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $669 = ((($668)) + 32|0); //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $670 = $x8; //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($669,$670); //@line 199 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $671 = $4; //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $672 = ((($671)) + 36|0); //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $673 = $x9; //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($672,$673); //@line 200 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $674 = $4; //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $675 = ((($674)) + 40|0); //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $676 = $x10; //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($675,$676); //@line 201 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $677 = $4; //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $678 = ((($677)) + 44|0); //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $679 = $x11; //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($678,$679); //@line 202 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $680 = $4; //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $681 = ((($680)) + 48|0); //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $682 = $x12; //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($681,$682); //@line 203 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $683 = $4; //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $684 = ((($683)) + 52|0); //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $685 = $x13; //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($684,$685); //@line 204 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $686 = $4; //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $687 = ((($686)) + 56|0); //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $688 = $x14; //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($687,$688); //@line 205 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $689 = $4; //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $690 = ((($689)) + 60|0); //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $691 = $x15; //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($690,$691); //@line 206 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $692 = $5; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $693 = $692; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $694 = HEAP32[$693>>2]|0; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $695 = (($692) + 4)|0; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $696 = $695; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $697 = HEAP32[$696>>2]|0; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $698 = ($697>>>0)<(0); //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $699 = ($694>>>0)<=(64); //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $700 = ($697|0)==(0); //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $701 = $700 & $699; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $702 = $698 | $701; //@line 208 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $703 = $5; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $704 = $703; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $705 = HEAP32[$704>>2]|0; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $706 = (($703) + 4)|0; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $707 = $706; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $708 = HEAP32[$707>>2]|0; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  if ($702) {
   break;
  }
  $737 = (_i64Subtract(($705|0),($708|0),64,0)|0); //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $738 = tempRet0; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $739 = $5; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $740 = $739; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  HEAP32[$740>>2] = $737; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $741 = (($739) + 4)|0; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $742 = $741; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  HEAP32[$742>>2] = $738; //@line 218 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $743 = $4; //@line 219 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $744 = ((($743)) + 64|0); //@line 219 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $4 = $744; //@line 219 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $745 = $3; //@line 220 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $746 = ((($745)) + 64|0); //@line 220 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $3 = $746; //@line 220 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 $709 = ($708>>>0)<(0); //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $710 = ($705>>>0)<(64); //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $711 = ($708|0)==(0); //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $712 = $711 & $710; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $713 = $709 | $712; //@line 209 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 L25: do {
  if ($713) {
   $i = 0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   while(1) {
    $714 = $i; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $715 = $5; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $716 = $715; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $717 = HEAP32[$716>>2]|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $718 = (($715) + 4)|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $719 = $718; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $720 = HEAP32[$719>>2]|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $721 = ($714>>>0)<($717>>>0); //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    if (!($721)) {
     break L25;
    }
    $722 = $i; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $723 = $4; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $724 = (($723) + ($722)|0); //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $725 = HEAP8[$724>>0]|0; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $726 = $i; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $727 = $ctarget; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $728 = (($727) + ($726)|0); //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    HEAP8[$728>>0] = $725; //@line 211 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $729 = $i; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $730 = (($729) + 1)|0; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
    $i = $730; //@line 210 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
   }
  }
 } while(0);
 $731 = $j12; //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $732 = $2; //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $733 = ((($732)) + 48|0); //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$733>>2] = $731; //@line 214 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $734 = $j13; //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $735 = $2; //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $736 = ((($735)) + 52|0); //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$736>>2] = $734; //@line 215 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 222 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _store32_le($dst,$w) {
 $dst = $dst|0;
 $w = $w|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $dst;
 $1 = $w;
 $2 = $1; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $3 = $2&255; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $4 = $0; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$4>>0] = $3; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $5 = $1; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $6 = $5 >>> 8; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $1 = $6; //@line 71 "libsodium/src/libsodium/include/sodium/private/common.h"
 $7 = $1; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $8 = $7&255; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $9 = $0; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $10 = ((($9)) + 1|0); //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$10>>0] = $8; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $11 = $1; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $12 = $11 >>> 8; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $1 = $12; //@line 72 "libsodium/src/libsodium/include/sodium/private/common.h"
 $13 = $1; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $14 = $13&255; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $15 = $0; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $16 = ((($15)) + 2|0); //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$16>>0] = $14; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $17 = $1; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $18 = $17 >>> 8; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $1 = $18; //@line 73 "libsodium/src/libsodium/include/sodium/private/common.h"
 $19 = $1; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 $20 = $19&255; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 $21 = $0; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 $22 = ((($21)) + 3|0); //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 HEAP8[$22>>0] = $20; //@line 74 "libsodium/src/libsodium/include/sodium/private/common.h"
 STACKTOP = sp;return; //@line 76 "libsodium/src/libsodium/include/sodium/private/common.h"
}
function _stream_ietf_ref($c,$0,$1,$n,$k) {
 $c = $c|0;
 $0 = $0|0;
 $1 = $1|0;
 $n = $n|0;
 $k = $k|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $ctx = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $4 = sp;
 $ctx = sp + 8|0;
 $3 = $c;
 $7 = $4;
 $8 = $7;
 HEAP32[$8>>2] = $0;
 $9 = (($7) + 4)|0;
 $10 = $9;
 HEAP32[$10>>2] = $1;
 $5 = $n;
 $6 = $k;
 $11 = $4; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $12 = $11; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = HEAP32[$12>>2]|0; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = (($11) + 4)|0; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = $14; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = HEAP32[$15>>2]|0; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = ($13|0)!=(0); //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = ($16|0)!=(0); //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = $17 | $18; //@line 249 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($19) {
  $20 = $6; //@line 253 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($ctx,$20); //@line 253 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $21 = $5; //@line 254 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ietf_ivsetup($ctx,$21,0); //@line 254 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $22 = $3; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $23 = $4; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $24 = $23; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $25 = HEAP32[$24>>2]|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $26 = (($23) + 4)|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $27 = $26; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $28 = HEAP32[$27>>2]|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _memset(($22|0),0,($25|0))|0; //@line 255 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $29 = $3; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $30 = $3; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $31 = $4; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $32 = $31; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = HEAP32[$32>>2]|0; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $34 = (($31) + 4)|0; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $35 = $34; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $36 = HEAP32[$35>>2]|0; //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($ctx,$29,$30,$33,$36); //@line 256 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($ctx,64); //@line 257 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $2 = 0; //@line 259 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = $2; //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($37|0); //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $2 = 0; //@line 250 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = $2; //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($37|0); //@line 260 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _chacha_ietf_ivsetup($ctx,$iv,$counter) {
 $ctx = $ctx|0;
 $iv = $iv|0;
 $counter = $counter|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $ctx;
 $1 = $iv;
 $2 = $counter;
 $3 = $2; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $4 = ($3|0)==(0|0); //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($4) {
  $9 = 0;
 } else {
  $5 = $2; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $6 = (_load32_le($5)|0); //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $9 = $6;
 }
 $7 = $0; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $8 = ((($7)) + 48|0); //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$8>>2] = $9; //@line 76 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $10 = $1; //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $11 = (_load32_le($10)|0); //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $12 = $0; //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $13 = ((($12)) + 52|0); //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$13>>2] = $11; //@line 77 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = $1; //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = ((($14)) + 4|0); //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = (_load32_le($15)|0); //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = $0; //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = ((($17)) + 56|0); //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$18>>2] = $16; //@line 78 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = $1; //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = ((($19)) + 8|0); //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = (_load32_le($20)|0); //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = $0; //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = ((($22)) + 60|0); //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 HEAP32[$23>>2] = $21; //@line 79 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 STACKTOP = sp;return; //@line 80 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
}
function _stream_ref_xor_ic($c,$m,$0,$1,$n,$2,$3,$k) {
 $c = $c|0;
 $m = $m|0;
 $0 = $0|0;
 $1 = $1|0;
 $n = $n|0;
 $2 = $2|0;
 $3 = $3|0;
 $k = $k|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $ctx = 0, $ic_bytes = 0, $ic_high = 0, $ic_low = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $7 = sp + 8|0;
 $9 = sp;
 $ctx = sp + 24|0;
 $ic_bytes = sp + 112|0;
 $5 = $c;
 $6 = $m;
 $11 = $7;
 $12 = $11;
 HEAP32[$12>>2] = $0;
 $13 = (($11) + 4)|0;
 $14 = $13;
 HEAP32[$14>>2] = $1;
 $8 = $n;
 $15 = $9;
 $16 = $15;
 HEAP32[$16>>2] = $2;
 $17 = (($15) + 4)|0;
 $18 = $17;
 HEAP32[$18>>2] = $3;
 $10 = $k;
 $19 = $7; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = $19; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = HEAP32[$20>>2]|0; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $22 = (($19) + 4)|0; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $23 = $22; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $24 = HEAP32[$23>>2]|0; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $25 = ($21|0)!=(0); //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $26 = ($24|0)!=(0); //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $27 = $25 | $26; //@line 273 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($27) {
  $28 = $9; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $29 = $28; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $30 = HEAP32[$29>>2]|0; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $31 = (($28) + 4)|0; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $32 = $31; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = HEAP32[$32>>2]|0; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $ic_high = $33; //@line 276 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $34 = $9; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $35 = $34; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $36 = HEAP32[$35>>2]|0; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $37 = (($34) + 4)|0; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $38 = $37; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $39 = HEAP32[$38>>2]|0; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $ic_low = $36; //@line 277 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $40 = $ic_low; //@line 278 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($ic_bytes,$40); //@line 278 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $41 = ((($ic_bytes)) + 4|0); //@line 279 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $42 = $ic_high; //@line 279 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($41,$42); //@line 279 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $43 = $10; //@line 280 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($ctx,$43); //@line 280 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $44 = $8; //@line 281 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ivsetup($ctx,$44,$ic_bytes); //@line 281 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $45 = $6; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $46 = $5; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $47 = $7; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $48 = $47; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $49 = HEAP32[$48>>2]|0; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $50 = (($47) + 4)|0; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $51 = $50; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $52 = HEAP32[$51>>2]|0; //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($ctx,$45,$46,$49,$52); //@line 282 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($ctx,64); //@line 283 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $4 = 0; //@line 285 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $53 = $4; //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($53|0); //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $4 = 0; //@line 274 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $53 = $4; //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($53|0); //@line 286 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _stream_ietf_ref_xor_ic($c,$m,$0,$1,$n,$ic,$k) {
 $c = $c|0;
 $m = $m|0;
 $0 = $0|0;
 $1 = $1|0;
 $n = $n|0;
 $ic = $ic|0;
 $k = $k|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $ctx = 0, $ic_bytes = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 112|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $5 = sp;
 $ctx = sp + 8|0;
 $ic_bytes = sp + 96|0;
 $3 = $c;
 $4 = $m;
 $9 = $5;
 $10 = $9;
 HEAP32[$10>>2] = $0;
 $11 = (($9) + 4)|0;
 $12 = $11;
 HEAP32[$12>>2] = $1;
 $6 = $n;
 $7 = $ic;
 $8 = $k;
 $13 = $5; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $14 = $13; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $15 = HEAP32[$14>>2]|0; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $16 = (($13) + 4)|0; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $17 = $16; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $18 = HEAP32[$17>>2]|0; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $19 = ($15|0)!=(0); //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $20 = ($18|0)!=(0); //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 $21 = $19 | $20; //@line 297 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 if ($21) {
  $22 = $7; //@line 300 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _store32_le($ic_bytes,$22); //@line 300 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $23 = $8; //@line 301 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_keysetup($ctx,$23); //@line 301 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $24 = $6; //@line 302 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_ietf_ivsetup($ctx,$24,$ic_bytes); //@line 302 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $25 = $4; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $26 = $3; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $27 = $5; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $28 = $27; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $29 = HEAP32[$28>>2]|0; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $30 = (($27) + 4)|0; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $31 = $30; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $32 = HEAP32[$31>>2]|0; //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _chacha_encrypt_bytes($ctx,$25,$26,$29,$32); //@line 303 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  _sodium_memzero($ctx,64); //@line 304 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $2 = 0; //@line 306 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = $2; //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($33|0); //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 } else {
  $2 = 0; //@line 298 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  $33 = $2; //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
  STACKTOP = sp;return ($33|0); //@line 307 "libsodium/src/libsodium/crypto_stream/chacha20/ref/stream_chacha20_ref.c"
 }
 return (0)|0;
}
function _reduce12289($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $c0 = 0, $c1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp;
 $3 = $2;
 $4 = $3;
 HEAP32[$4>>2] = $0;
 $5 = (($3) + 4)|0;
 $6 = $5;
 HEAP32[$6>>2] = $1;
 $7 = $2; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $8 = $7; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $9 = HEAP32[$8>>2]|0; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $10 = (($7) + 4)|0; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $11 = $10; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $12 = HEAP32[$11>>2]|0; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $13 = $9 & 4095; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $c0 = $13; //@line 20 "LatticeCrypto_v1.0/generic/ntt.c"
 $14 = $2; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $15 = $14; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $16 = HEAP32[$15>>2]|0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $17 = (($14) + 4)|0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $18 = $17; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $19 = HEAP32[$18>>2]|0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $20 = (_bitshift64Ashr(($16|0),($19|0),12)|0); //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $21 = tempRet0; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $c1 = $20; //@line 21 "LatticeCrypto_v1.0/generic/ntt.c"
 $22 = $c0; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 $23 = ($22*3)|0; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 $24 = $c1; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 $25 = (($23) - ($24))|0; //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
 STACKTOP = sp;return ($25|0); //@line 23 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _reduce12289_2x($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $c0 = 0, $c1 = 0, $c2 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $2 = sp;
 $3 = $2;
 $4 = $3;
 HEAP32[$4>>2] = $0;
 $5 = (($3) + 4)|0;
 $6 = $5;
 HEAP32[$6>>2] = $1;
 $7 = $2; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $8 = $7; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $9 = HEAP32[$8>>2]|0; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $10 = (($7) + 4)|0; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $11 = $10; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $12 = HEAP32[$11>>2]|0; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $13 = $9 & 4095; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $c0 = $13; //@line 31 "LatticeCrypto_v1.0/generic/ntt.c"
 $14 = $2; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $15 = $14; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $16 = HEAP32[$15>>2]|0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $17 = (($14) + 4)|0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $18 = $17; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $19 = HEAP32[$18>>2]|0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $20 = (_bitshift64Ashr(($16|0),($19|0),12)|0); //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $21 = tempRet0; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $22 = $20 & 4095; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $c1 = $22; //@line 32 "LatticeCrypto_v1.0/generic/ntt.c"
 $23 = $2; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $24 = $23; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $25 = HEAP32[$24>>2]|0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $26 = (($23) + 4)|0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $27 = $26; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $28 = HEAP32[$27>>2]|0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $29 = (_bitshift64Ashr(($25|0),($28|0),24)|0); //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $30 = tempRet0; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $c2 = $29; //@line 33 "LatticeCrypto_v1.0/generic/ntt.c"
 $31 = $c0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $32 = ($31*9)|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $33 = $c1; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $34 = ($33*3)|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $35 = (($32) - ($34))|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $36 = $c2; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 $37 = (($35) + ($36))|0; //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
 STACKTOP = sp;return ($37|0); //@line 35 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _NTT_CT_std2rev_12289($a,$psi_rev,$N) {
 $a = $a|0;
 $psi_rev = $psi_rev|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0;
 var $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0;
 var $97 = 0, $98 = 0, $99 = 0, $S = 0, $U = 0, $V = 0, $i = 0, $j = 0, $j1 = 0, $j2 = 0, $k = 0, $m = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $psi_rev;
 $2 = $N;
 $3 = $2; //@line 41 "LatticeCrypto_v1.0/generic/ntt.c"
 $k = $3; //@line 41 "LatticeCrypto_v1.0/generic/ntt.c"
 $m = 1; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $4 = $m; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  $5 = ($4>>>0)<(128); //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($5)) {
   break;
  }
  $6 = $k; //@line 45 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = $6 >>> 1; //@line 45 "LatticeCrypto_v1.0/generic/ntt.c"
  $k = $7; //@line 45 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = 0; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $8 = $i; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $9 = $m; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $10 = ($8>>>0)<($9>>>0); //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($10)) {
    break;
   }
   $11 = $i; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $12 = $11<<1; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $13 = $k; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $14 = Math_imul($12, $13)|0; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $j1 = $14; //@line 47 "LatticeCrypto_v1.0/generic/ntt.c"
   $15 = $j1; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $16 = $k; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $17 = (($15) + ($16))|0; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $18 = (($17) - 1)|0; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $j2 = $18; //@line 48 "LatticeCrypto_v1.0/generic/ntt.c"
   $19 = $m; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $20 = $i; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $21 = (($19) + ($20))|0; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $22 = $1; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $23 = (($22) + ($21<<2)|0); //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $24 = HEAP32[$23>>2]|0; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $S = $24; //@line 49 "LatticeCrypto_v1.0/generic/ntt.c"
   $25 = $j1; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
   $j = $25; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
   while(1) {
    $26 = $j; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $27 = $j2; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $28 = ($26>>>0)<=($27>>>0); //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    if (!($28)) {
     break;
    }
    $29 = $j; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $30 = $0; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $31 = (($30) + ($29<<2)|0); //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $32 = HEAP32[$31>>2]|0; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $U = $32; //@line 51 "LatticeCrypto_v1.0/generic/ntt.c"
    $33 = $j; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $34 = $k; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $35 = (($33) + ($34))|0; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $36 = $0; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $37 = (($36) + ($35<<2)|0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $38 = HEAP32[$37>>2]|0; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $39 = ($38|0)<(0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $40 = $39 << 31 >> 31; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $41 = $S; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $42 = ($41|0)<(0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $43 = $42 << 31 >> 31; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $44 = (___muldi3(($38|0),($40|0),($41|0),($43|0))|0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $45 = tempRet0; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $46 = (_reduce12289($44,$45)|0); //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $V = $46; //@line 52 "LatticeCrypto_v1.0/generic/ntt.c"
    $47 = $U; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $48 = $V; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $49 = (($47) + ($48))|0; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $50 = $j; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $51 = $0; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $52 = (($51) + ($50<<2)|0); //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$52>>2] = $49; //@line 53 "LatticeCrypto_v1.0/generic/ntt.c"
    $53 = $U; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $54 = $V; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $55 = (($53) - ($54))|0; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $56 = $j; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $57 = $k; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $58 = (($56) + ($57))|0; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $59 = $0; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $60 = (($59) + ($58<<2)|0); //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$60>>2] = $55; //@line 54 "LatticeCrypto_v1.0/generic/ntt.c"
    $61 = $j; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $62 = (($61) + 1)|0; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
    $j = $62; //@line 50 "LatticeCrypto_v1.0/generic/ntt.c"
   }
   $63 = $i; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $64 = (($63) + 1)|0; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
   $i = $64; //@line 46 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $65 = $m; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  $66 = $65<<1; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
  $m = $66; //@line 44 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 $k = 4; //@line 59 "LatticeCrypto_v1.0/generic/ntt.c"
 $i = 0; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $67 = $i; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  $68 = ($67>>>0)<(128); //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($68)) {
   break;
  }
  $69 = $i; //@line 61 "LatticeCrypto_v1.0/generic/ntt.c"
  $70 = $69<<3; //@line 61 "LatticeCrypto_v1.0/generic/ntt.c"
  $j1 = $70; //@line 61 "LatticeCrypto_v1.0/generic/ntt.c"
  $71 = $j1; //@line 62 "LatticeCrypto_v1.0/generic/ntt.c"
  $72 = (($71) + 3)|0; //@line 62 "LatticeCrypto_v1.0/generic/ntt.c"
  $j2 = $72; //@line 62 "LatticeCrypto_v1.0/generic/ntt.c"
  $73 = $i; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $74 = (($73) + 128)|0; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $75 = $1; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $76 = (($75) + ($74<<2)|0); //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $77 = HEAP32[$76>>2]|0; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $S = $77; //@line 63 "LatticeCrypto_v1.0/generic/ntt.c"
  $78 = $j1; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
  $j = $78; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $79 = $j; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $80 = $j2; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $81 = ($79>>>0)<=($80>>>0); //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($81)) {
    break;
   }
   $82 = $j; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $83 = $0; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $84 = (($83) + ($82<<2)|0); //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $85 = HEAP32[$84>>2]|0; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $86 = ($85|0)<(0); //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $87 = $86 << 31 >> 31; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $88 = (_reduce12289($85,$87)|0); //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $U = $88; //@line 65 "LatticeCrypto_v1.0/generic/ntt.c"
   $89 = $j; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $90 = (($89) + 4)|0; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $91 = $0; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $92 = (($91) + ($90<<2)|0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $93 = HEAP32[$92>>2]|0; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $94 = ($93|0)<(0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $95 = $94 << 31 >> 31; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $96 = $S; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $97 = ($96|0)<(0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $98 = $97 << 31 >> 31; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $99 = (___muldi3(($93|0),($95|0),($96|0),($98|0))|0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $100 = tempRet0; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $101 = (_reduce12289_2x($99,$100)|0); //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $V = $101; //@line 66 "LatticeCrypto_v1.0/generic/ntt.c"
   $102 = $U; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $103 = $V; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $104 = (($102) + ($103))|0; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $105 = $j; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $106 = $0; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $107 = (($106) + ($105<<2)|0); //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   HEAP32[$107>>2] = $104; //@line 67 "LatticeCrypto_v1.0/generic/ntt.c"
   $108 = $U; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $109 = $V; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $110 = (($108) - ($109))|0; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $111 = $j; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $112 = (($111) + 4)|0; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $113 = $0; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $114 = (($113) + ($112<<2)|0); //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   HEAP32[$114>>2] = $110; //@line 68 "LatticeCrypto_v1.0/generic/ntt.c"
   $115 = $j; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $116 = (($115) + 1)|0; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
   $j = $116; //@line 64 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $117 = $i; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  $118 = (($117) + 1)|0; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $118; //@line 60 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 $m = 256; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $119 = $m; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $120 = $2; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $121 = ($119>>>0)<($120>>>0); //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($121)) {
   break;
  }
  $122 = $k; //@line 73 "LatticeCrypto_v1.0/generic/ntt.c"
  $123 = $122 >>> 1; //@line 73 "LatticeCrypto_v1.0/generic/ntt.c"
  $k = $123; //@line 73 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = 0; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $124 = $i; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $125 = $m; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $126 = ($124>>>0)<($125>>>0); //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($126)) {
    break;
   }
   $127 = $i; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $128 = $127<<1; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $129 = $k; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $130 = Math_imul($128, $129)|0; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $j1 = $130; //@line 75 "LatticeCrypto_v1.0/generic/ntt.c"
   $131 = $j1; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $132 = $k; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $133 = (($131) + ($132))|0; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $134 = (($133) - 1)|0; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $j2 = $134; //@line 76 "LatticeCrypto_v1.0/generic/ntt.c"
   $135 = $m; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $136 = $i; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $137 = (($135) + ($136))|0; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $138 = $1; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $139 = (($138) + ($137<<2)|0); //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $140 = HEAP32[$139>>2]|0; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $S = $140; //@line 77 "LatticeCrypto_v1.0/generic/ntt.c"
   $141 = $j1; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
   $j = $141; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
   while(1) {
    $142 = $j; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $143 = $j2; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $144 = ($142>>>0)<=($143>>>0); //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    if (!($144)) {
     break;
    }
    $145 = $j; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $146 = $0; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $147 = (($146) + ($145<<2)|0); //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $148 = HEAP32[$147>>2]|0; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $U = $148; //@line 79 "LatticeCrypto_v1.0/generic/ntt.c"
    $149 = $j; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $150 = $k; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $151 = (($149) + ($150))|0; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $152 = $0; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $153 = (($152) + ($151<<2)|0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $154 = HEAP32[$153>>2]|0; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $155 = ($154|0)<(0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $156 = $155 << 31 >> 31; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $157 = $S; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $158 = ($157|0)<(0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $159 = $158 << 31 >> 31; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $160 = (___muldi3(($154|0),($156|0),($157|0),($159|0))|0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $161 = tempRet0; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $162 = (_reduce12289($160,$161)|0); //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $V = $162; //@line 80 "LatticeCrypto_v1.0/generic/ntt.c"
    $163 = $U; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $164 = $V; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $165 = (($163) + ($164))|0; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $166 = $j; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $167 = $0; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $168 = (($167) + ($166<<2)|0); //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$168>>2] = $165; //@line 81 "LatticeCrypto_v1.0/generic/ntt.c"
    $169 = $U; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $170 = $V; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $171 = (($169) - ($170))|0; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $172 = $j; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $173 = $k; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $174 = (($172) + ($173))|0; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $175 = $0; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $176 = (($175) + ($174<<2)|0); //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$176>>2] = $171; //@line 82 "LatticeCrypto_v1.0/generic/ntt.c"
    $177 = $j; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $178 = (($177) + 1)|0; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
    $j = $178; //@line 78 "LatticeCrypto_v1.0/generic/ntt.c"
   }
   $179 = $i; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $180 = (($179) + 1)|0; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
   $i = $180; //@line 74 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $181 = $m; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $182 = $181<<1; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
  $m = $182; //@line 72 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 86 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _INTT_GS_rev2std_12289($a,$omegainv_rev,$omegainv1N_rev,$Ninv,$N) {
 $a = $a|0;
 $omegainv_rev = $omegainv_rev|0;
 $omegainv1N_rev = $omegainv1N_rev|0;
 $Ninv = $Ninv|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $S = 0, $U = 0, $V = 0, $h = 0, $i = 0, $j = 0, $j1 = 0, $j2 = 0, $k = 0, $m = 0;
 var $temp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $temp = sp;
 $0 = $a;
 $1 = $omegainv_rev;
 $2 = $omegainv1N_rev;
 $3 = $Ninv;
 $4 = $N;
 $k = 1; //@line 92 "LatticeCrypto_v1.0/generic/ntt.c"
 $5 = $4; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
 $m = $5; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $6 = $m; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = ($6>>>0)>(2); //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($7)) {
   break;
  }
  $j1 = 0; //@line 97 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = $m; //@line 98 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = $8 >>> 1; //@line 98 "LatticeCrypto_v1.0/generic/ntt.c"
  $h = $9; //@line 98 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = 0; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
  while(1) {
   $10 = $i; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $11 = $h; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $12 = ($10>>>0)<($11>>>0); //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   if (!($12)) {
    break;
   }
   $13 = $j1; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $14 = $k; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $15 = (($13) + ($14))|0; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $16 = (($15) - 1)|0; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $j2 = $16; //@line 100 "LatticeCrypto_v1.0/generic/ntt.c"
   $17 = $h; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $18 = $i; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $19 = (($17) + ($18))|0; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $20 = $1; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $21 = (($20) + ($19<<2)|0); //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $22 = HEAP32[$21>>2]|0; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $S = $22; //@line 101 "LatticeCrypto_v1.0/generic/ntt.c"
   $23 = $j1; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
   $j = $23; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
   while(1) {
    $24 = $j; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $25 = $j2; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $26 = ($24>>>0)<=($25>>>0); //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    if (!($26)) {
     break;
    }
    $27 = $j; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $28 = $0; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $29 = (($28) + ($27<<2)|0); //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $30 = HEAP32[$29>>2]|0; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $U = $30; //@line 103 "LatticeCrypto_v1.0/generic/ntt.c"
    $31 = $j; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $32 = $k; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $33 = (($31) + ($32))|0; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $34 = $0; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $35 = (($34) + ($33<<2)|0); //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $36 = HEAP32[$35>>2]|0; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $V = $36; //@line 104 "LatticeCrypto_v1.0/generic/ntt.c"
    $37 = $U; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $38 = $V; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $39 = (($37) + ($38))|0; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $40 = $j; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $41 = $0; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $42 = (($41) + ($40<<2)|0); //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$42>>2] = $39; //@line 105 "LatticeCrypto_v1.0/generic/ntt.c"
    $43 = $U; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $44 = $V; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $45 = (($43) - ($44))|0; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $46 = ($45|0)<(0); //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $47 = $46 << 31 >> 31; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $48 = $S; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $49 = ($48|0)<(0); //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $50 = $49 << 31 >> 31; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $51 = (___muldi3(($45|0),($47|0),($48|0),($50|0))|0); //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $52 = tempRet0; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $53 = $temp; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $54 = $53; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$54>>2] = $51; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $55 = (($53) + 4)|0; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $56 = $55; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    HEAP32[$56>>2] = $52; //@line 106 "LatticeCrypto_v1.0/generic/ntt.c"
    $57 = $m; //@line 107 "LatticeCrypto_v1.0/generic/ntt.c"
    $58 = ($57|0)==(32); //@line 107 "LatticeCrypto_v1.0/generic/ntt.c"
    if ($58) {
     $59 = $j; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $60 = $0; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $61 = (($60) + ($59<<2)|0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $62 = HEAP32[$61>>2]|0; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $63 = ($62|0)<(0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $64 = $63 << 31 >> 31; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $65 = (_reduce12289($62,$64)|0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $66 = $j; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $67 = $0; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $68 = (($67) + ($66<<2)|0); //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     HEAP32[$68>>2] = $65; //@line 108 "LatticeCrypto_v1.0/generic/ntt.c"
     $69 = $temp; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $70 = $69; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $71 = HEAP32[$70>>2]|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $72 = (($69) + 4)|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $73 = $72; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $74 = HEAP32[$73>>2]|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $75 = (_reduce12289_2x($71,$74)|0); //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $76 = $j; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $77 = $k; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $78 = (($76) + ($77))|0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $79 = $0; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     $80 = (($79) + ($78<<2)|0); //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
     HEAP32[$80>>2] = $75; //@line 109 "LatticeCrypto_v1.0/generic/ntt.c"
    } else {
     $81 = $temp; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $82 = $81; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $83 = HEAP32[$82>>2]|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $84 = (($81) + 4)|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $85 = $84; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $86 = HEAP32[$85>>2]|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $87 = (_reduce12289($83,$86)|0); //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $88 = $j; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $89 = $k; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $90 = (($88) + ($89))|0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $91 = $0; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     $92 = (($91) + ($90<<2)|0); //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
     HEAP32[$92>>2] = $87; //@line 111 "LatticeCrypto_v1.0/generic/ntt.c"
    }
    $93 = $j; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $94 = (($93) + 1)|0; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
    $j = $94; //@line 102 "LatticeCrypto_v1.0/generic/ntt.c"
   }
   $95 = $j1; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $96 = $k; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $97 = $96<<1; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $98 = (($95) + ($97))|0; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $j1 = $98; //@line 114 "LatticeCrypto_v1.0/generic/ntt.c"
   $99 = $i; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $100 = (($99) + 1)|0; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
   $i = $100; //@line 99 "LatticeCrypto_v1.0/generic/ntt.c"
  }
  $101 = $k; //@line 116 "LatticeCrypto_v1.0/generic/ntt.c"
  $102 = $101<<1; //@line 116 "LatticeCrypto_v1.0/generic/ntt.c"
  $k = $102; //@line 116 "LatticeCrypto_v1.0/generic/ntt.c"
  $103 = $m; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  $104 = $103 >>> 1; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
  $m = $104; //@line 96 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 $j = 0; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $105 = $j; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $106 = $k; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $107 = ($105>>>0)<($106>>>0); //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($107)) {
   break;
  }
  $108 = $j; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $109 = $0; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $110 = (($109) + ($108<<2)|0); //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $111 = HEAP32[$110>>2]|0; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $U = $111; //@line 119 "LatticeCrypto_v1.0/generic/ntt.c"
  $112 = $j; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $113 = $k; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $114 = (($112) + ($113))|0; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $115 = $0; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $116 = (($115) + ($114<<2)|0); //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $117 = HEAP32[$116>>2]|0; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $V = $117; //@line 120 "LatticeCrypto_v1.0/generic/ntt.c"
  $118 = $U; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $119 = $V; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $120 = (($118) + ($119))|0; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $121 = ($120|0)<(0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $122 = $121 << 31 >> 31; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $123 = $3; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $124 = ($123|0)<(0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $125 = $124 << 31 >> 31; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $126 = (___muldi3(($120|0),($122|0),($123|0),($125|0))|0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $127 = tempRet0; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $128 = (_reduce12289($126,$127)|0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $129 = $j; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $130 = $0; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $131 = (($130) + ($129<<2)|0); //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$131>>2] = $128; //@line 121 "LatticeCrypto_v1.0/generic/ntt.c"
  $132 = $U; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $133 = $V; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $134 = (($132) - ($133))|0; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $135 = ($134|0)<(0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $136 = $135 << 31 >> 31; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $137 = $2; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $138 = ($137|0)<(0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $139 = $138 << 31 >> 31; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $140 = (___muldi3(($134|0),($136|0),($137|0),($139|0))|0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $141 = tempRet0; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $142 = (_reduce12289($140,$141)|0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $143 = $j; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $144 = $k; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $145 = (($143) + ($144))|0; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $146 = $0; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $147 = (($146) + ($145<<2)|0); //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$147>>2] = $142; //@line 122 "LatticeCrypto_v1.0/generic/ntt.c"
  $148 = $j; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $149 = (($148) + 1)|0; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
  $j = $149; //@line 118 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 124 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _two_reduce12289($a,$N) {
 $a = $a|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $N;
 $i = 0; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $2 = $i; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $3 = $1; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $4 = ($2>>>0)<($3>>>0); //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($4)) {
   break;
  }
  $5 = $i; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $6 = $0; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = (($6) + ($5<<2)|0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = HEAP32[$7>>2]|0; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = ($8|0)<(0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = $9 << 31 >> 31; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = (_reduce12289($8,$10)|0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = $i; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $0; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = (($13) + ($12<<2)|0); //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$14>>2] = $11; //@line 133 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = $i; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = $0; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = (($16) + ($15<<2)|0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = HEAP32[$17>>2]|0; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = ($18|0)<(0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = $19 << 31 >> 31; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = (_reduce12289($18,$20)|0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = $i; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = $0; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = (($23) + ($22<<2)|0); //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$24>>2] = $21; //@line 134 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = $i; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = (($25) + 1)|0; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $26; //@line 132 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 136 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _pmul($a,$b,$c,$N) {
 $a = $a|0;
 $b = $b|0;
 $c = $c|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $b;
 $2 = $c;
 $3 = $N;
 $i = 0; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $4 = $i; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $5 = $3; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $6 = ($4>>>0)<($5>>>0); //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($6)) {
   break;
  }
  $7 = $i; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = $0; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = (($8) + ($7<<2)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = HEAP32[$9>>2]|0; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = ($10|0)<(0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = $11 << 31 >> 31; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $i; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = $1; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = (($14) + ($13<<2)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = HEAP32[$15>>2]|0; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = ($16|0)<(0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = $17 << 31 >> 31; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = (___muldi3(($10|0),($12|0),($16|0),($18|0))|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = tempRet0; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = (_reduce12289($19,$20)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = $i; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = $2; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = (($23) + ($22<<2)|0); //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$24>>2] = $21; //@line 144 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = $i; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = $2; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $27 = (($26) + ($25<<2)|0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $28 = HEAP32[$27>>2]|0; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $29 = ($28|0)<(0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $30 = $29 << 31 >> 31; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $31 = (_reduce12289($28,$30)|0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $32 = $i; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $33 = $2; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $34 = (($33) + ($32<<2)|0); //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$34>>2] = $31; //@line 145 "LatticeCrypto_v1.0/generic/ntt.c"
  $35 = $i; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $36 = (($35) + 1)|0; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $36; //@line 143 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 147 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _pmuladd($a,$b,$c,$d,$N) {
 $a = $a|0;
 $b = $b|0;
 $c = $c|0;
 $d = $d|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $b;
 $2 = $c;
 $3 = $d;
 $4 = $N;
 $i = 0; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $5 = $i; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $6 = $4; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = ($5>>>0)<($6>>>0); //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($7)) {
   break;
  }
  $8 = $i; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = $0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = (($9) + ($8<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = HEAP32[$10>>2]|0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = ($11|0)<(0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $12 << 31 >> 31; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = $i; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = $1; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = (($15) + ($14<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = HEAP32[$16>>2]|0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = ($17|0)<(0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = $18 << 31 >> 31; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = (___muldi3(($11|0),($13|0),($17|0),($19|0))|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = tempRet0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = $i; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = $2; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = (($23) + ($22<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = HEAP32[$24>>2]|0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = ($25|0)<(0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $27 = $26 << 31 >> 31; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $28 = (_i64Add(($20|0),($21|0),($25|0),($27|0))|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $29 = tempRet0; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $30 = (_reduce12289($28,$29)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $31 = $i; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $32 = $3; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $33 = (($32) + ($31<<2)|0); //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$33>>2] = $30; //@line 155 "LatticeCrypto_v1.0/generic/ntt.c"
  $34 = $i; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $35 = $3; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $36 = (($35) + ($34<<2)|0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $37 = HEAP32[$36>>2]|0; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $38 = ($37|0)<(0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $39 = $38 << 31 >> 31; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $40 = (_reduce12289($37,$39)|0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $41 = $i; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $42 = $3; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $43 = (($42) + ($41<<2)|0); //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$43>>2] = $40; //@line 156 "LatticeCrypto_v1.0/generic/ntt.c"
  $44 = $i; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $45 = (($44) + 1)|0; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $45; //@line 154 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 158 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _smul($a,$scalar,$N) {
 $a = $a|0;
 $scalar = $scalar|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $scalar;
 $2 = $N;
 $i = 0; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $3 = $i; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $4 = $2; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $5 = ($3>>>0)<($4>>>0); //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($5)) {
   break;
  }
  $6 = $i; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = $0; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = (($7) + ($6<<2)|0); //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = HEAP32[$8>>2]|0; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = $1; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = Math_imul($9, $10)|0; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = $i; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $0; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = (($13) + ($12<<2)|0); //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$14>>2] = $11; //@line 166 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = $i; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = (($15) + 1)|0; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $16; //@line 165 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 168 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _correction($a,$p,$N) {
 $a = $a|0;
 $p = $p|0;
 $N = $N|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $mask = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $p;
 $2 = $N;
 $i = 0; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
 while(1) {
  $3 = $i; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $4 = $2; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $5 = ($3>>>0)<($4>>>0); //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  if (!($5)) {
   break;
  }
  $6 = $i; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $7 = $0; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $8 = (($7) + ($6<<2)|0); //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $9 = HEAP32[$8>>2]|0; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $10 = $9 >> 15; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $mask = $10; //@line 177 "LatticeCrypto_v1.0/generic/ntt.c"
  $11 = $1; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $12 = $mask; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $13 = $11 & $12; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $14 = $1; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $15 = (($13) - ($14))|0; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $16 = $i; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $17 = $0; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $18 = (($17) + ($16<<2)|0); //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $19 = HEAP32[$18>>2]|0; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $20 = (($19) + ($15))|0; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$18>>2] = $20; //@line 178 "LatticeCrypto_v1.0/generic/ntt.c"
  $21 = $i; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $22 = $0; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $23 = (($22) + ($21<<2)|0); //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $24 = HEAP32[$23>>2]|0; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $25 = $24 >> 15; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $mask = $25; //@line 179 "LatticeCrypto_v1.0/generic/ntt.c"
  $26 = $1; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $27 = $mask; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $28 = $26 & $27; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $29 = $i; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $30 = $0; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $31 = (($30) + ($29<<2)|0); //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $32 = HEAP32[$31>>2]|0; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $33 = (($32) + ($28))|0; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  HEAP32[$31>>2] = $33; //@line 180 "LatticeCrypto_v1.0/generic/ntt.c"
  $34 = $i; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $35 = (($34) + 1)|0; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
  $i = $35; //@line 176 "LatticeCrypto_v1.0/generic/ntt.c"
 }
 STACKTOP = sp;return; //@line 182 "LatticeCrypto_v1.0/generic/ntt.c"
}
function _clear_words($mem,$nwords) {
 $mem = $mem|0;
 $nwords = $nwords|0;
 var $0 = 0, $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $v = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $mem;
 $1 = $nwords;
 $2 = $0; //@line 32 "LatticeCrypto_v1.0/kex.c"
 $v = $2; //@line 32 "LatticeCrypto_v1.0/kex.c"
 $i = 0; //@line 34 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $i; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $4 = $1; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $5 = ($3>>>0)<($4>>>0); //@line 34 "LatticeCrypto_v1.0/kex.c"
  if (!($5)) {
   break;
  }
  $6 = $i; //@line 35 "LatticeCrypto_v1.0/kex.c"
  $7 = $v; //@line 35 "LatticeCrypto_v1.0/kex.c"
  $8 = (($7) + ($6<<2)|0); //@line 35 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$8>>2] = 0; //@line 35 "LatticeCrypto_v1.0/kex.c"
  $9 = $i; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $10 = (($9) + 1)|0; //@line 34 "LatticeCrypto_v1.0/kex.c"
  $i = $10; //@line 34 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 37 "LatticeCrypto_v1.0/kex.c"
}
function _LatticeCrypto_initialize($pLatticeCrypto,$RandomBytesFunction,$ExtendableOutputFunction,$StreamOutputFunction) {
 $pLatticeCrypto = $pLatticeCrypto|0;
 $RandomBytesFunction = $RandomBytesFunction|0;
 $ExtendableOutputFunction = $ExtendableOutputFunction|0;
 $StreamOutputFunction = $StreamOutputFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pLatticeCrypto;
 $1 = $RandomBytesFunction;
 $2 = $ExtendableOutputFunction;
 $3 = $StreamOutputFunction;
 $4 = $1; //@line 43 "LatticeCrypto_v1.0/kex.c"
 $5 = $0; //@line 43 "LatticeCrypto_v1.0/kex.c"
 HEAP32[$5>>2] = $4; //@line 43 "LatticeCrypto_v1.0/kex.c"
 $6 = $2; //@line 44 "LatticeCrypto_v1.0/kex.c"
 $7 = $0; //@line 44 "LatticeCrypto_v1.0/kex.c"
 $8 = ((($7)) + 4|0); //@line 44 "LatticeCrypto_v1.0/kex.c"
 HEAP32[$8>>2] = $6; //@line 44 "LatticeCrypto_v1.0/kex.c"
 $9 = $3; //@line 45 "LatticeCrypto_v1.0/kex.c"
 $10 = $0; //@line 45 "LatticeCrypto_v1.0/kex.c"
 $11 = ((($10)) + 8|0); //@line 45 "LatticeCrypto_v1.0/kex.c"
 HEAP32[$11>>2] = $9; //@line 45 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return 0; //@line 47 "LatticeCrypto_v1.0/kex.c"
}
function _LatticeCrypto_allocate() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $LatticeCrypto = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $LatticeCrypto = 0; //@line 54 "LatticeCrypto_v1.0/kex.c"
 $1 = (_calloc(1,12)|0); //@line 56 "LatticeCrypto_v1.0/kex.c"
 $LatticeCrypto = $1; //@line 56 "LatticeCrypto_v1.0/kex.c"
 $2 = $LatticeCrypto; //@line 58 "LatticeCrypto_v1.0/kex.c"
 $3 = ($2|0)==(0|0); //@line 58 "LatticeCrypto_v1.0/kex.c"
 if ($3) {
  $0 = 0; //@line 59 "LatticeCrypto_v1.0/kex.c"
 } else {
  $4 = $LatticeCrypto; //@line 61 "LatticeCrypto_v1.0/kex.c"
  $0 = $4; //@line 61 "LatticeCrypto_v1.0/kex.c"
 }
 $5 = $0; //@line 62 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($5|0); //@line 62 "LatticeCrypto_v1.0/kex.c"
}
function _encode_A($pk,$seed,$m) {
 $pk = $pk|0;
 $seed = $seed|0;
 $m = $m|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $i = 0, $j = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pk;
 $1 = $seed;
 $2 = $m;
 $i = 0; //@line 92 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 95 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $j; //@line 95 "LatticeCrypto_v1.0/kex.c"
  $4 = ($3>>>0)<(1024); //@line 95 "LatticeCrypto_v1.0/kex.c"
  if (!($4)) {
   break;
  }
  $5 = $j; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $6 = $0; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $7 = (($6) + ($5<<2)|0); //@line 96 "LatticeCrypto_v1.0/kex.c"
  $8 = HEAP32[$7>>2]|0; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $9 = $8 & 255; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $10 = $9&255; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $11 = $i; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $12 = $2; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $13 = (($12) + ($11)|0); //@line 96 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$13>>0] = $10; //@line 96 "LatticeCrypto_v1.0/kex.c"
  $14 = $j; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $15 = $0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $16 = (($15) + ($14<<2)|0); //@line 97 "LatticeCrypto_v1.0/kex.c"
  $17 = HEAP32[$16>>2]|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $18 = $17 >>> 8; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $19 = $j; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $20 = (($19) + 1)|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $21 = $0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $22 = (($21) + ($20<<2)|0); //@line 97 "LatticeCrypto_v1.0/kex.c"
  $23 = HEAP32[$22>>2]|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $24 = $23 & 3; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $25 = $24 << 6; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $26 = $18 | $25; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $27 = $26&255; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $28 = $i; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $29 = (($28) + 1)|0; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $30 = $2; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $31 = (($30) + ($29)|0); //@line 97 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$31>>0] = $27; //@line 97 "LatticeCrypto_v1.0/kex.c"
  $32 = $j; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $33 = (($32) + 1)|0; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $34 = $0; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $35 = (($34) + ($33<<2)|0); //@line 98 "LatticeCrypto_v1.0/kex.c"
  $36 = HEAP32[$35>>2]|0; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $37 = $36 >>> 2; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $38 = $37 & 255; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $39 = $38&255; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $40 = $i; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $41 = (($40) + 2)|0; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $42 = $2; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $43 = (($42) + ($41)|0); //@line 98 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$43>>0] = $39; //@line 98 "LatticeCrypto_v1.0/kex.c"
  $44 = $j; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $45 = (($44) + 1)|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $46 = $0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $47 = (($46) + ($45<<2)|0); //@line 99 "LatticeCrypto_v1.0/kex.c"
  $48 = HEAP32[$47>>2]|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $49 = $48 >>> 10; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $50 = $j; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $51 = (($50) + 2)|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $52 = $0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $53 = (($52) + ($51<<2)|0); //@line 99 "LatticeCrypto_v1.0/kex.c"
  $54 = HEAP32[$53>>2]|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $55 = $54 & 15; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $56 = $55 << 4; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $57 = $49 | $56; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $58 = $57&255; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $59 = $i; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $60 = (($59) + 3)|0; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $61 = $2; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $62 = (($61) + ($60)|0); //@line 99 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$62>>0] = $58; //@line 99 "LatticeCrypto_v1.0/kex.c"
  $63 = $j; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $64 = (($63) + 2)|0; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $65 = $0; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $66 = (($65) + ($64<<2)|0); //@line 100 "LatticeCrypto_v1.0/kex.c"
  $67 = HEAP32[$66>>2]|0; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $68 = $67 >>> 4; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $69 = $68 & 255; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $70 = $69&255; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $71 = $i; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $72 = (($71) + 4)|0; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $73 = $2; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $74 = (($73) + ($72)|0); //@line 100 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$74>>0] = $70; //@line 100 "LatticeCrypto_v1.0/kex.c"
  $75 = $j; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $76 = (($75) + 2)|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $77 = $0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $78 = (($77) + ($76<<2)|0); //@line 101 "LatticeCrypto_v1.0/kex.c"
  $79 = HEAP32[$78>>2]|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $80 = $79 >>> 12; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $81 = $j; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $82 = (($81) + 3)|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $83 = $0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $84 = (($83) + ($82<<2)|0); //@line 101 "LatticeCrypto_v1.0/kex.c"
  $85 = HEAP32[$84>>2]|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $86 = $85 & 63; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $87 = $86 << 2; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $88 = $80 | $87; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $89 = $88&255; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $90 = $i; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $91 = (($90) + 5)|0; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $92 = $2; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $93 = (($92) + ($91)|0); //@line 101 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$93>>0] = $89; //@line 101 "LatticeCrypto_v1.0/kex.c"
  $94 = $j; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $95 = (($94) + 3)|0; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $96 = $0; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $97 = (($96) + ($95<<2)|0); //@line 102 "LatticeCrypto_v1.0/kex.c"
  $98 = HEAP32[$97>>2]|0; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $99 = $98 >>> 6; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $100 = $99&255; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $101 = $i; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $102 = (($101) + 6)|0; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $103 = $2; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $104 = (($103) + ($102)|0); //@line 102 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$104>>0] = $100; //@line 102 "LatticeCrypto_v1.0/kex.c"
  $105 = $i; //@line 103 "LatticeCrypto_v1.0/kex.c"
  $106 = (($105) + 7)|0; //@line 103 "LatticeCrypto_v1.0/kex.c"
  $i = $106; //@line 103 "LatticeCrypto_v1.0/kex.c"
  $107 = $j; //@line 95 "LatticeCrypto_v1.0/kex.c"
  $108 = (($107) + 4)|0; //@line 95 "LatticeCrypto_v1.0/kex.c"
  $j = $108; //@line 95 "LatticeCrypto_v1.0/kex.c"
 }
 $j = 0; //@line 111 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $109 = $j; //@line 111 "LatticeCrypto_v1.0/kex.c"
  $110 = ($109>>>0)<(32); //@line 111 "LatticeCrypto_v1.0/kex.c"
  if (!($110)) {
   break;
  }
  $111 = $j; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $112 = $1; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $113 = (($112) + ($111)|0); //@line 112 "LatticeCrypto_v1.0/kex.c"
  $114 = HEAP8[$113>>0]|0; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $115 = $i; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $116 = $j; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $117 = (($115) + ($116))|0; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $118 = $2; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $119 = (($118) + ($117)|0); //@line 112 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$119>>0] = $114; //@line 112 "LatticeCrypto_v1.0/kex.c"
  $120 = $j; //@line 111 "LatticeCrypto_v1.0/kex.c"
  $121 = (($120) + 1)|0; //@line 111 "LatticeCrypto_v1.0/kex.c"
  $j = $121; //@line 111 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 114 "LatticeCrypto_v1.0/kex.c"
}
function _decode_A($m,$pk,$seed) {
 $m = $m|0;
 $pk = $pk|0;
 $seed = $seed|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $12 = 0, $13 = 0;
 var $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $i = 0, $j = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $m;
 $1 = $pk;
 $2 = $seed;
 $i = 0; //@line 119 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 122 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $j; //@line 122 "LatticeCrypto_v1.0/kex.c"
  $4 = ($3>>>0)<(1024); //@line 122 "LatticeCrypto_v1.0/kex.c"
  if (!($4)) {
   break;
  }
  $5 = $i; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $6 = $0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $7 = (($6) + ($5)|0); //@line 123 "LatticeCrypto_v1.0/kex.c"
  $8 = HEAP8[$7>>0]|0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $9 = $8&255; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $10 = $i; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $11 = (($10) + 1)|0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $12 = $0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $13 = (($12) + ($11)|0); //@line 123 "LatticeCrypto_v1.0/kex.c"
  $14 = HEAP8[$13>>0]|0; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $15 = $14&255; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $16 = $15 & 63; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $17 = $16 << 8; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $18 = $9 | $17; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $19 = $j; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $20 = $1; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $21 = (($20) + ($19<<2)|0); //@line 123 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$21>>2] = $18; //@line 123 "LatticeCrypto_v1.0/kex.c"
  $22 = $i; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $23 = (($22) + 1)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $24 = $0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $25 = (($24) + ($23)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  $26 = HEAP8[$25>>0]|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $27 = $26&255; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $28 = $27 >>> 6; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $29 = $i; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $30 = (($29) + 2)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $31 = $0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $32 = (($31) + ($30)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  $33 = HEAP8[$32>>0]|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $34 = $33&255; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $35 = $34 << 2; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $36 = $28 | $35; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $37 = $i; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $38 = (($37) + 3)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $39 = $0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $40 = (($39) + ($38)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  $41 = HEAP8[$40>>0]|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $42 = $41&255; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $43 = $42 & 15; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $44 = $43 << 10; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $45 = $36 | $44; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $46 = $j; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $47 = (($46) + 1)|0; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $48 = $1; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $49 = (($48) + ($47<<2)|0); //@line 124 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$49>>2] = $45; //@line 124 "LatticeCrypto_v1.0/kex.c"
  $50 = $i; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $51 = (($50) + 3)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $52 = $0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $53 = (($52) + ($51)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  $54 = HEAP8[$53>>0]|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $55 = $54&255; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $56 = $55 >>> 4; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $57 = $i; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $58 = (($57) + 4)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $59 = $0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $60 = (($59) + ($58)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  $61 = HEAP8[$60>>0]|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $62 = $61&255; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $63 = $62 << 4; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $64 = $56 | $63; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $65 = $i; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $66 = (($65) + 5)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $67 = $0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $68 = (($67) + ($66)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  $69 = HEAP8[$68>>0]|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $70 = $69&255; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $71 = $70 & 3; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $72 = $71 << 12; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $73 = $64 | $72; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $74 = $j; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $75 = (($74) + 2)|0; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $76 = $1; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $77 = (($76) + ($75<<2)|0); //@line 125 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$77>>2] = $73; //@line 125 "LatticeCrypto_v1.0/kex.c"
  $78 = $i; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $79 = (($78) + 5)|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $80 = $0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $81 = (($80) + ($79)|0); //@line 126 "LatticeCrypto_v1.0/kex.c"
  $82 = HEAP8[$81>>0]|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $83 = $82&255; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $84 = $83 >>> 2; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $85 = $i; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $86 = (($85) + 6)|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $87 = $0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $88 = (($87) + ($86)|0); //@line 126 "LatticeCrypto_v1.0/kex.c"
  $89 = HEAP8[$88>>0]|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $90 = $89&255; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $91 = $90 << 6; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $92 = $84 | $91; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $93 = $j; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $94 = (($93) + 3)|0; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $95 = $1; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $96 = (($95) + ($94<<2)|0); //@line 126 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$96>>2] = $92; //@line 126 "LatticeCrypto_v1.0/kex.c"
  $97 = $i; //@line 127 "LatticeCrypto_v1.0/kex.c"
  $98 = (($97) + 7)|0; //@line 127 "LatticeCrypto_v1.0/kex.c"
  $i = $98; //@line 127 "LatticeCrypto_v1.0/kex.c"
  $99 = $j; //@line 122 "LatticeCrypto_v1.0/kex.c"
  $100 = (($99) + 4)|0; //@line 122 "LatticeCrypto_v1.0/kex.c"
  $j = $100; //@line 122 "LatticeCrypto_v1.0/kex.c"
 }
 $j = 0; //@line 135 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $101 = $j; //@line 135 "LatticeCrypto_v1.0/kex.c"
  $102 = ($101>>>0)<(32); //@line 135 "LatticeCrypto_v1.0/kex.c"
  if (!($102)) {
   break;
  }
  $103 = $i; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $104 = $j; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $105 = (($103) + ($104))|0; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $106 = $0; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $107 = (($106) + ($105)|0); //@line 136 "LatticeCrypto_v1.0/kex.c"
  $108 = HEAP8[$107>>0]|0; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $109 = $j; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $110 = $2; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $111 = (($110) + ($109)|0); //@line 136 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$111>>0] = $108; //@line 136 "LatticeCrypto_v1.0/kex.c"
  $112 = $j; //@line 135 "LatticeCrypto_v1.0/kex.c"
  $113 = (($112) + 1)|0; //@line 135 "LatticeCrypto_v1.0/kex.c"
  $j = $113; //@line 135 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 138 "LatticeCrypto_v1.0/kex.c"
}
function _encode_B($pk,$rvec,$m) {
 $pk = $pk|0;
 $rvec = $rvec|0;
 $m = $m|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0;
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $i = 0, $j = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $pk;
 $1 = $rvec;
 $2 = $m;
 $i = 0; //@line 143 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 146 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $j; //@line 146 "LatticeCrypto_v1.0/kex.c"
  $4 = ($3>>>0)<(1024); //@line 146 "LatticeCrypto_v1.0/kex.c"
  if (!($4)) {
   break;
  }
  $5 = $j; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $6 = $0; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $7 = (($6) + ($5<<2)|0); //@line 147 "LatticeCrypto_v1.0/kex.c"
  $8 = HEAP32[$7>>2]|0; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $9 = $8 & 255; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $10 = $9&255; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $11 = $i; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $12 = $2; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $13 = (($12) + ($11)|0); //@line 147 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$13>>0] = $10; //@line 147 "LatticeCrypto_v1.0/kex.c"
  $14 = $j; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $15 = $0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $16 = (($15) + ($14<<2)|0); //@line 148 "LatticeCrypto_v1.0/kex.c"
  $17 = HEAP32[$16>>2]|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $18 = $17 >>> 8; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $19 = $j; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $20 = (($19) + 1)|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $21 = $0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $22 = (($21) + ($20<<2)|0); //@line 148 "LatticeCrypto_v1.0/kex.c"
  $23 = HEAP32[$22>>2]|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $24 = $23 & 3; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $25 = $24 << 6; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $26 = $18 | $25; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $27 = $26&255; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $28 = $i; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $29 = (($28) + 1)|0; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $30 = $2; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $31 = (($30) + ($29)|0); //@line 148 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$31>>0] = $27; //@line 148 "LatticeCrypto_v1.0/kex.c"
  $32 = $j; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $33 = (($32) + 1)|0; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $34 = $0; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $35 = (($34) + ($33<<2)|0); //@line 149 "LatticeCrypto_v1.0/kex.c"
  $36 = HEAP32[$35>>2]|0; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $37 = $36 >>> 2; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $38 = $37 & 255; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $39 = $38&255; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $40 = $i; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $41 = (($40) + 2)|0; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $42 = $2; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $43 = (($42) + ($41)|0); //@line 149 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$43>>0] = $39; //@line 149 "LatticeCrypto_v1.0/kex.c"
  $44 = $j; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $45 = (($44) + 1)|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $46 = $0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $47 = (($46) + ($45<<2)|0); //@line 150 "LatticeCrypto_v1.0/kex.c"
  $48 = HEAP32[$47>>2]|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $49 = $48 >>> 10; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $50 = $j; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $51 = (($50) + 2)|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $52 = $0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $53 = (($52) + ($51<<2)|0); //@line 150 "LatticeCrypto_v1.0/kex.c"
  $54 = HEAP32[$53>>2]|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $55 = $54 & 15; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $56 = $55 << 4; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $57 = $49 | $56; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $58 = $57&255; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $59 = $i; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $60 = (($59) + 3)|0; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $61 = $2; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $62 = (($61) + ($60)|0); //@line 150 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$62>>0] = $58; //@line 150 "LatticeCrypto_v1.0/kex.c"
  $63 = $j; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $64 = (($63) + 2)|0; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $65 = $0; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $66 = (($65) + ($64<<2)|0); //@line 151 "LatticeCrypto_v1.0/kex.c"
  $67 = HEAP32[$66>>2]|0; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $68 = $67 >>> 4; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $69 = $68 & 255; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $70 = $69&255; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $71 = $i; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $72 = (($71) + 4)|0; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $73 = $2; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $74 = (($73) + ($72)|0); //@line 151 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$74>>0] = $70; //@line 151 "LatticeCrypto_v1.0/kex.c"
  $75 = $j; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $76 = (($75) + 2)|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $77 = $0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $78 = (($77) + ($76<<2)|0); //@line 152 "LatticeCrypto_v1.0/kex.c"
  $79 = HEAP32[$78>>2]|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $80 = $79 >>> 12; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $81 = $j; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $82 = (($81) + 3)|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $83 = $0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $84 = (($83) + ($82<<2)|0); //@line 152 "LatticeCrypto_v1.0/kex.c"
  $85 = HEAP32[$84>>2]|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $86 = $85 & 63; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $87 = $86 << 2; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $88 = $80 | $87; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $89 = $88&255; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $90 = $i; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $91 = (($90) + 5)|0; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $92 = $2; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $93 = (($92) + ($91)|0); //@line 152 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$93>>0] = $89; //@line 152 "LatticeCrypto_v1.0/kex.c"
  $94 = $j; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $95 = (($94) + 3)|0; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $96 = $0; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $97 = (($96) + ($95<<2)|0); //@line 153 "LatticeCrypto_v1.0/kex.c"
  $98 = HEAP32[$97>>2]|0; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $99 = $98 >>> 6; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $100 = $99&255; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $101 = $i; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $102 = (($101) + 6)|0; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $103 = $2; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $104 = (($103) + ($102)|0); //@line 153 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$104>>0] = $100; //@line 153 "LatticeCrypto_v1.0/kex.c"
  $105 = $i; //@line 154 "LatticeCrypto_v1.0/kex.c"
  $106 = (($105) + 7)|0; //@line 154 "LatticeCrypto_v1.0/kex.c"
  $i = $106; //@line 154 "LatticeCrypto_v1.0/kex.c"
  $107 = $j; //@line 146 "LatticeCrypto_v1.0/kex.c"
  $108 = (($107) + 4)|0; //@line 146 "LatticeCrypto_v1.0/kex.c"
  $j = $108; //@line 146 "LatticeCrypto_v1.0/kex.c"
 }
 $i = 0; //@line 161 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 162 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $109 = $j; //@line 162 "LatticeCrypto_v1.0/kex.c"
  $110 = ($109>>>0)<(256); //@line 162 "LatticeCrypto_v1.0/kex.c"
  if (!($110)) {
   break;
  }
  $111 = $i; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $112 = $1; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $113 = (($112) + ($111<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $114 = HEAP32[$113>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $115 = $i; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $116 = (($115) + 1)|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $117 = $1; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $118 = (($117) + ($116<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $119 = HEAP32[$118>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $120 = $119 << 2; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $121 = $114 | $120; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $122 = $i; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $123 = (($122) + 2)|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $124 = $1; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $125 = (($124) + ($123<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $126 = HEAP32[$125>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $127 = $126 << 4; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $128 = $121 | $127; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $129 = $i; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $130 = (($129) + 3)|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $131 = $1; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $132 = (($131) + ($130<<2)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  $133 = HEAP32[$132>>2]|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $134 = $133 << 6; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $135 = $128 | $134; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $136 = $135&255; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $137 = $j; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $138 = (1792 + ($137))|0; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $139 = $2; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $140 = (($139) + ($138)|0); //@line 163 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$140>>0] = $136; //@line 163 "LatticeCrypto_v1.0/kex.c"
  $141 = $i; //@line 164 "LatticeCrypto_v1.0/kex.c"
  $142 = (($141) + 4)|0; //@line 164 "LatticeCrypto_v1.0/kex.c"
  $i = $142; //@line 164 "LatticeCrypto_v1.0/kex.c"
  $143 = $j; //@line 162 "LatticeCrypto_v1.0/kex.c"
  $144 = (($143) + 1)|0; //@line 162 "LatticeCrypto_v1.0/kex.c"
  $j = $144; //@line 162 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 166 "LatticeCrypto_v1.0/kex.c"
}
function _decode_B($m,$pk,$rvec) {
 $m = $m|0;
 $pk = $pk|0;
 $rvec = $rvec|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0;
 var $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $i = 0, $j = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $m;
 $1 = $pk;
 $2 = $rvec;
 $i = 0; //@line 171 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 174 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $j; //@line 174 "LatticeCrypto_v1.0/kex.c"
  $4 = ($3>>>0)<(1024); //@line 174 "LatticeCrypto_v1.0/kex.c"
  if (!($4)) {
   break;
  }
  $5 = $i; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $6 = $0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $7 = (($6) + ($5)|0); //@line 175 "LatticeCrypto_v1.0/kex.c"
  $8 = HEAP8[$7>>0]|0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $9 = $8&255; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $10 = $i; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $11 = (($10) + 1)|0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $12 = $0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $13 = (($12) + ($11)|0); //@line 175 "LatticeCrypto_v1.0/kex.c"
  $14 = HEAP8[$13>>0]|0; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $15 = $14&255; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $16 = $15 & 63; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $17 = $16 << 8; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $18 = $9 | $17; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $19 = $j; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $20 = $1; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $21 = (($20) + ($19<<2)|0); //@line 175 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$21>>2] = $18; //@line 175 "LatticeCrypto_v1.0/kex.c"
  $22 = $i; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $23 = (($22) + 1)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $24 = $0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $25 = (($24) + ($23)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  $26 = HEAP8[$25>>0]|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $27 = $26&255; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $28 = $27 >>> 6; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $29 = $i; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $30 = (($29) + 2)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $31 = $0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $32 = (($31) + ($30)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  $33 = HEAP8[$32>>0]|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $34 = $33&255; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $35 = $34 << 2; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $36 = $28 | $35; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $37 = $i; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $38 = (($37) + 3)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $39 = $0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $40 = (($39) + ($38)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  $41 = HEAP8[$40>>0]|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $42 = $41&255; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $43 = $42 & 15; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $44 = $43 << 10; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $45 = $36 | $44; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $46 = $j; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $47 = (($46) + 1)|0; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $48 = $1; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $49 = (($48) + ($47<<2)|0); //@line 176 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$49>>2] = $45; //@line 176 "LatticeCrypto_v1.0/kex.c"
  $50 = $i; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $51 = (($50) + 3)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $52 = $0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $53 = (($52) + ($51)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  $54 = HEAP8[$53>>0]|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $55 = $54&255; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $56 = $55 >>> 4; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $57 = $i; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $58 = (($57) + 4)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $59 = $0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $60 = (($59) + ($58)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  $61 = HEAP8[$60>>0]|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $62 = $61&255; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $63 = $62 << 4; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $64 = $56 | $63; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $65 = $i; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $66 = (($65) + 5)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $67 = $0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $68 = (($67) + ($66)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  $69 = HEAP8[$68>>0]|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $70 = $69&255; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $71 = $70 & 3; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $72 = $71 << 12; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $73 = $64 | $72; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $74 = $j; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $75 = (($74) + 2)|0; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $76 = $1; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $77 = (($76) + ($75<<2)|0); //@line 177 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$77>>2] = $73; //@line 177 "LatticeCrypto_v1.0/kex.c"
  $78 = $i; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $79 = (($78) + 5)|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $80 = $0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $81 = (($80) + ($79)|0); //@line 178 "LatticeCrypto_v1.0/kex.c"
  $82 = HEAP8[$81>>0]|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $83 = $82&255; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $84 = $83 >>> 2; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $85 = $i; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $86 = (($85) + 6)|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $87 = $0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $88 = (($87) + ($86)|0); //@line 178 "LatticeCrypto_v1.0/kex.c"
  $89 = HEAP8[$88>>0]|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $90 = $89&255; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $91 = $90 << 6; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $92 = $84 | $91; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $93 = $j; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $94 = (($93) + 3)|0; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $95 = $1; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $96 = (($95) + ($94<<2)|0); //@line 178 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$96>>2] = $92; //@line 178 "LatticeCrypto_v1.0/kex.c"
  $97 = $i; //@line 179 "LatticeCrypto_v1.0/kex.c"
  $98 = (($97) + 7)|0; //@line 179 "LatticeCrypto_v1.0/kex.c"
  $i = $98; //@line 179 "LatticeCrypto_v1.0/kex.c"
  $99 = $j; //@line 174 "LatticeCrypto_v1.0/kex.c"
  $100 = (($99) + 4)|0; //@line 174 "LatticeCrypto_v1.0/kex.c"
  $j = $100; //@line 174 "LatticeCrypto_v1.0/kex.c"
 }
 $i = 0; //@line 187 "LatticeCrypto_v1.0/kex.c"
 $j = 0; //@line 188 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $101 = $j; //@line 188 "LatticeCrypto_v1.0/kex.c"
  $102 = ($101>>>0)<(256); //@line 188 "LatticeCrypto_v1.0/kex.c"
  if (!($102)) {
   break;
  }
  $103 = $j; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $104 = (1792 + ($103))|0; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $105 = $0; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $106 = (($105) + ($104)|0); //@line 189 "LatticeCrypto_v1.0/kex.c"
  $107 = HEAP8[$106>>0]|0; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $108 = $107&255; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $109 = $108 & 3; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $110 = $i; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $111 = $2; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $112 = (($111) + ($110<<2)|0); //@line 189 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$112>>2] = $109; //@line 189 "LatticeCrypto_v1.0/kex.c"
  $113 = $j; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $114 = (1792 + ($113))|0; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $115 = $0; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $116 = (($115) + ($114)|0); //@line 190 "LatticeCrypto_v1.0/kex.c"
  $117 = HEAP8[$116>>0]|0; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $118 = $117&255; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $119 = $118 >> 2; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $120 = $119 & 3; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $121 = $i; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $122 = (($121) + 1)|0; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $123 = $2; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $124 = (($123) + ($122<<2)|0); //@line 190 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$124>>2] = $120; //@line 190 "LatticeCrypto_v1.0/kex.c"
  $125 = $j; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $126 = (1792 + ($125))|0; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $127 = $0; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $128 = (($127) + ($126)|0); //@line 191 "LatticeCrypto_v1.0/kex.c"
  $129 = HEAP8[$128>>0]|0; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $130 = $129&255; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $131 = $130 >> 4; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $132 = $131 & 3; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $133 = $i; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $134 = (($133) + 2)|0; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $135 = $2; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $136 = (($135) + ($134<<2)|0); //@line 191 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$136>>2] = $132; //@line 191 "LatticeCrypto_v1.0/kex.c"
  $137 = $j; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $138 = (1792 + ($137))|0; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $139 = $0; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $140 = (($139) + ($138)|0); //@line 192 "LatticeCrypto_v1.0/kex.c"
  $141 = HEAP8[$140>>0]|0; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $142 = $141&255; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $143 = $142 >> 6; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $144 = $i; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $145 = (($144) + 3)|0; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $146 = $2; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $147 = (($146) + ($145<<2)|0); //@line 192 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$147>>2] = $143; //@line 192 "LatticeCrypto_v1.0/kex.c"
  $148 = $i; //@line 193 "LatticeCrypto_v1.0/kex.c"
  $149 = (($148) + 4)|0; //@line 193 "LatticeCrypto_v1.0/kex.c"
  $i = $149; //@line 193 "LatticeCrypto_v1.0/kex.c"
  $150 = $j; //@line 188 "LatticeCrypto_v1.0/kex.c"
  $151 = (($150) + 1)|0; //@line 188 "LatticeCrypto_v1.0/kex.c"
  $j = $151; //@line 188 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 195 "LatticeCrypto_v1.0/kex.c"
}
function _HelpRec($x,$rvec,$seed,$nonce,$StreamOutputFunction) {
 $x = $x|0;
 $rvec = $rvec|0;
 $seed = $seed|0;
 $nonce = $nonce|0;
 $StreamOutputFunction = $StreamOutputFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $Status = 0, $bit = 0, $i = 0, $j = 0, $nce = 0, $norm = 0, $random_bits = 0, $v0 = 0, $v1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $random_bits = sp + 88|0;
 $nce = sp + 80|0;
 $v0 = sp + 24|0;
 $v1 = sp + 8|0;
 $1 = $x;
 $2 = $rvec;
 $3 = $seed;
 $4 = $nonce;
 $5 = $StreamOutputFunction;
 ;HEAP8[$nce>>0]=0|0;HEAP8[$nce+1>>0]=0|0;HEAP8[$nce+2>>0]=0|0;HEAP8[$nce+3>>0]=0|0;HEAP8[$nce+4>>0]=0|0;HEAP8[$nce+5>>0]=0|0;HEAP8[$nce+6>>0]=0|0;HEAP8[$nce+7>>0]=0|0; //@line 210 "LatticeCrypto_v1.0/kex.c"
 $Status = 3; //@line 212 "LatticeCrypto_v1.0/kex.c"
 $6 = $4; //@line 214 "LatticeCrypto_v1.0/kex.c"
 $7 = $6&255; //@line 214 "LatticeCrypto_v1.0/kex.c"
 $8 = ((($nce)) + 1|0); //@line 214 "LatticeCrypto_v1.0/kex.c"
 HEAP8[$8>>0] = $7; //@line 214 "LatticeCrypto_v1.0/kex.c"
 $9 = $3; //@line 215 "LatticeCrypto_v1.0/kex.c"
 $10 = $5; //@line 215 "LatticeCrypto_v1.0/kex.c"
 $11 = (_stream_output($9,32,$nce,32,32,$random_bits,$10)|0); //@line 215 "LatticeCrypto_v1.0/kex.c"
 $Status = $11; //@line 215 "LatticeCrypto_v1.0/kex.c"
 $12 = $Status; //@line 216 "LatticeCrypto_v1.0/kex.c"
 $13 = ($12|0)!=(0); //@line 216 "LatticeCrypto_v1.0/kex.c"
 if ($13) {
  _clear_words($random_bits,8); //@line 217 "LatticeCrypto_v1.0/kex.c"
  $14 = $Status; //@line 218 "LatticeCrypto_v1.0/kex.c"
  $0 = $14; //@line 218 "LatticeCrypto_v1.0/kex.c"
  $280 = $0; //@line 259 "LatticeCrypto_v1.0/kex.c"
  STACKTOP = sp;return ($280|0); //@line 259 "LatticeCrypto_v1.0/kex.c"
 }
 $i = 0; //@line 225 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $15 = $i; //@line 225 "LatticeCrypto_v1.0/kex.c"
  $16 = ($15>>>0)<(256); //@line 225 "LatticeCrypto_v1.0/kex.c"
  if (!($16)) {
   break;
  }
  $17 = $i; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $18 = $17 >>> 3; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $19 = (($random_bits) + ($18)|0); //@line 226 "LatticeCrypto_v1.0/kex.c"
  $20 = HEAP8[$19>>0]|0; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $21 = $20&255; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $22 = $i; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $23 = $22 & 7; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $24 = $21 >> $23; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $25 = 1 & $24; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $26 = $25&255; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $bit = $26; //@line 226 "LatticeCrypto_v1.0/kex.c"
  $27 = $i; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $28 = $1; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $29 = (($28) + ($27<<2)|0); //@line 227 "LatticeCrypto_v1.0/kex.c"
  $30 = HEAP32[$29>>2]|0; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $31 = $30 << 1; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $32 = $bit; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $33 = $32&255; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $34 = (($31) - ($33))|0; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $35 = $i; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $36 = $2; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $37 = (($36) + ($35<<2)|0); //@line 227 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$37>>2] = $34; //@line 227 "LatticeCrypto_v1.0/kex.c"
  $38 = $i; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $39 = (($38) + 256)|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $40 = $1; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $41 = (($40) + ($39<<2)|0); //@line 228 "LatticeCrypto_v1.0/kex.c"
  $42 = HEAP32[$41>>2]|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $43 = $42 << 1; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $44 = $bit; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $45 = $44&255; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $46 = (($43) - ($45))|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $47 = $i; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $48 = (($47) + 256)|0; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $49 = $2; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $50 = (($49) + ($48<<2)|0); //@line 228 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$50>>2] = $46; //@line 228 "LatticeCrypto_v1.0/kex.c"
  $51 = $i; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $52 = (($51) + 512)|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $53 = $1; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $54 = (($53) + ($52<<2)|0); //@line 229 "LatticeCrypto_v1.0/kex.c"
  $55 = HEAP32[$54>>2]|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $56 = $55 << 1; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $57 = $bit; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $58 = $57&255; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $59 = (($56) - ($58))|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $60 = $i; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $61 = (($60) + 512)|0; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $62 = $2; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $63 = (($62) + ($61<<2)|0); //@line 229 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$63>>2] = $59; //@line 229 "LatticeCrypto_v1.0/kex.c"
  $64 = $i; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $65 = (($64) + 768)|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $66 = $1; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $67 = (($66) + ($65<<2)|0); //@line 230 "LatticeCrypto_v1.0/kex.c"
  $68 = HEAP32[$67>>2]|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $69 = $68 << 1; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $70 = $bit; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $71 = $70&255; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $72 = (($69) - ($71))|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $73 = $i; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $74 = (($73) + 768)|0; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $75 = $2; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $76 = (($75) + ($74<<2)|0); //@line 230 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$76>>2] = $72; //@line 230 "LatticeCrypto_v1.0/kex.c"
  $norm = 0; //@line 232 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$v0>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  $77 = ((($v0)) + 4|0); //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$77>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  $78 = ((($v0)) + 8|0); //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$78>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  $79 = ((($v0)) + 12|0); //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$79>>2] = 4; //@line 233 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$v1>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $80 = ((($v1)) + 4|0); //@line 234 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$80>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $81 = ((($v1)) + 8|0); //@line 234 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$81>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $82 = ((($v1)) + 12|0); //@line 234 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$82>>2] = 3; //@line 234 "LatticeCrypto_v1.0/kex.c"
  $j = 0; //@line 235 "LatticeCrypto_v1.0/kex.c"
  while(1) {
   $83 = $j; //@line 235 "LatticeCrypto_v1.0/kex.c"
   $84 = ($83>>>0)<(4); //@line 235 "LatticeCrypto_v1.0/kex.c"
   if (!($84)) {
    break;
   }
   $85 = $i; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $86 = $j; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $87 = $86<<8; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $88 = (($85) + ($87))|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $89 = $2; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $90 = (($89) + ($88<<2)|0); //@line 236 "LatticeCrypto_v1.0/kex.c"
   $91 = HEAP32[$90>>2]|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $92 = (($91) - 3073)|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $93 = $92 >>> 31; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $94 = $j; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $95 = (($v0) + ($94<<2)|0); //@line 236 "LatticeCrypto_v1.0/kex.c"
   $96 = HEAP32[$95>>2]|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $97 = (($96) - ($93))|0; //@line 236 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$95>>2] = $97; //@line 236 "LatticeCrypto_v1.0/kex.c"
   $98 = $i; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $99 = $j; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $100 = $99<<8; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $101 = (($98) + ($100))|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $102 = $2; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $103 = (($102) + ($101<<2)|0); //@line 237 "LatticeCrypto_v1.0/kex.c"
   $104 = HEAP32[$103>>2]|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $105 = (($104) - 9217)|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $106 = $105 >>> 31; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $107 = $j; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $108 = (($v0) + ($107<<2)|0); //@line 237 "LatticeCrypto_v1.0/kex.c"
   $109 = HEAP32[$108>>2]|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $110 = (($109) - ($106))|0; //@line 237 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$108>>2] = $110; //@line 237 "LatticeCrypto_v1.0/kex.c"
   $111 = $i; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $112 = $j; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $113 = $112<<8; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $114 = (($111) + ($113))|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $115 = $2; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $116 = (($115) + ($114<<2)|0); //@line 238 "LatticeCrypto_v1.0/kex.c"
   $117 = HEAP32[$116>>2]|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $118 = (($117) - 15362)|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $119 = $118 >>> 31; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $120 = $j; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $121 = (($v0) + ($120<<2)|0); //@line 238 "LatticeCrypto_v1.0/kex.c"
   $122 = HEAP32[$121>>2]|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $123 = (($122) - ($119))|0; //@line 238 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$121>>2] = $123; //@line 238 "LatticeCrypto_v1.0/kex.c"
   $124 = $i; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $125 = $j; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $126 = $125<<8; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $127 = (($124) + ($126))|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $128 = $2; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $129 = (($128) + ($127<<2)|0); //@line 239 "LatticeCrypto_v1.0/kex.c"
   $130 = HEAP32[$129>>2]|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $131 = (($130) - 21506)|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $132 = $131 >>> 31; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $133 = $j; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $134 = (($v0) + ($133<<2)|0); //@line 239 "LatticeCrypto_v1.0/kex.c"
   $135 = HEAP32[$134>>2]|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $136 = (($135) - ($132))|0; //@line 239 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$134>>2] = $136; //@line 239 "LatticeCrypto_v1.0/kex.c"
   $137 = $i; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $138 = $j; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $139 = $138<<8; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $140 = (($137) + ($139))|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $141 = $2; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $142 = (($141) + ($140<<2)|0); //@line 240 "LatticeCrypto_v1.0/kex.c"
   $143 = HEAP32[$142>>2]|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $144 = (($143) - 6145)|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $145 = $144 >>> 31; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $146 = $j; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $147 = (($v1) + ($146<<2)|0); //@line 240 "LatticeCrypto_v1.0/kex.c"
   $148 = HEAP32[$147>>2]|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $149 = (($148) - ($145))|0; //@line 240 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$147>>2] = $149; //@line 240 "LatticeCrypto_v1.0/kex.c"
   $150 = $i; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $151 = $j; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $152 = $151<<8; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $153 = (($150) + ($152))|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $154 = $2; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $155 = (($154) + ($153<<2)|0); //@line 241 "LatticeCrypto_v1.0/kex.c"
   $156 = HEAP32[$155>>2]|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $157 = (($156) - 12289)|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $158 = $157 >>> 31; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $159 = $j; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $160 = (($v1) + ($159<<2)|0); //@line 241 "LatticeCrypto_v1.0/kex.c"
   $161 = HEAP32[$160>>2]|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $162 = (($161) - ($158))|0; //@line 241 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$160>>2] = $162; //@line 241 "LatticeCrypto_v1.0/kex.c"
   $163 = $i; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $164 = $j; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $165 = $164<<8; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $166 = (($163) + ($165))|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $167 = $2; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $168 = (($167) + ($166<<2)|0); //@line 242 "LatticeCrypto_v1.0/kex.c"
   $169 = HEAP32[$168>>2]|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $170 = (($169) - 18434)|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $171 = $170 >>> 31; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $172 = $j; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $173 = (($v1) + ($172<<2)|0); //@line 242 "LatticeCrypto_v1.0/kex.c"
   $174 = HEAP32[$173>>2]|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $175 = (($174) - ($171))|0; //@line 242 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$173>>2] = $175; //@line 242 "LatticeCrypto_v1.0/kex.c"
   $176 = $i; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $177 = $j; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $178 = $177<<8; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $179 = (($176) + ($178))|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $180 = $2; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $181 = (($180) + ($179<<2)|0); //@line 243 "LatticeCrypto_v1.0/kex.c"
   $182 = HEAP32[$181>>2]|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $183 = $182<<1; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $184 = $j; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $185 = (($v0) + ($184<<2)|0); //@line 243 "LatticeCrypto_v1.0/kex.c"
   $186 = HEAP32[$185>>2]|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $187 = ($186*12289)|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $188 = (($183) - ($187))|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $189 = (_Abs($188)|0); //@line 243 "LatticeCrypto_v1.0/kex.c"
   $190 = $norm; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $191 = (($190) + ($189))|0; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $norm = $191; //@line 243 "LatticeCrypto_v1.0/kex.c"
   $192 = $j; //@line 235 "LatticeCrypto_v1.0/kex.c"
   $193 = (($192) + 1)|0; //@line 235 "LatticeCrypto_v1.0/kex.c"
   $j = $193; //@line 235 "LatticeCrypto_v1.0/kex.c"
  }
  $194 = $norm; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $195 = (($194) - 12289)|0; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $196 = $195 >> 31; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $norm = $196; //@line 246 "LatticeCrypto_v1.0/kex.c"
  $197 = $norm; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $198 = HEAP32[$v0>>2]|0; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $199 = HEAP32[$v1>>2]|0; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $200 = $198 ^ $199; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $201 = $197 & $200; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $202 = HEAP32[$v1>>2]|0; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $203 = $201 ^ $202; //@line 247 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$v0>>2] = $203; //@line 247 "LatticeCrypto_v1.0/kex.c"
  $204 = $norm; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $205 = ((($v0)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  $206 = HEAP32[$205>>2]|0; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $207 = ((($v1)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  $208 = HEAP32[$207>>2]|0; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $209 = $206 ^ $208; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $210 = $204 & $209; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $211 = ((($v1)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  $212 = HEAP32[$211>>2]|0; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $213 = $210 ^ $212; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $214 = ((($v0)) + 4|0); //@line 248 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$214>>2] = $213; //@line 248 "LatticeCrypto_v1.0/kex.c"
  $215 = $norm; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $216 = ((($v0)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  $217 = HEAP32[$216>>2]|0; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $218 = ((($v1)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  $219 = HEAP32[$218>>2]|0; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $220 = $217 ^ $219; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $221 = $215 & $220; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $222 = ((($v1)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  $223 = HEAP32[$222>>2]|0; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $224 = $221 ^ $223; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $225 = ((($v0)) + 8|0); //@line 249 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$225>>2] = $224; //@line 249 "LatticeCrypto_v1.0/kex.c"
  $226 = $norm; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $227 = ((($v0)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  $228 = HEAP32[$227>>2]|0; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $229 = ((($v1)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  $230 = HEAP32[$229>>2]|0; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $231 = $228 ^ $230; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $232 = $226 & $231; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $233 = ((($v1)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  $234 = HEAP32[$233>>2]|0; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $235 = $232 ^ $234; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $236 = ((($v0)) + 12|0); //@line 250 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$236>>2] = $235; //@line 250 "LatticeCrypto_v1.0/kex.c"
  $237 = HEAP32[$v0>>2]|0; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $238 = ((($v0)) + 12|0); //@line 251 "LatticeCrypto_v1.0/kex.c"
  $239 = HEAP32[$238>>2]|0; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $240 = (($237) - ($239))|0; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $241 = $240 & 3; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $242 = $i; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $243 = $2; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $244 = (($243) + ($242<<2)|0); //@line 251 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$244>>2] = $241; //@line 251 "LatticeCrypto_v1.0/kex.c"
  $245 = ((($v0)) + 4|0); //@line 252 "LatticeCrypto_v1.0/kex.c"
  $246 = HEAP32[$245>>2]|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $247 = ((($v0)) + 12|0); //@line 252 "LatticeCrypto_v1.0/kex.c"
  $248 = HEAP32[$247>>2]|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $249 = (($246) - ($248))|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $250 = $249 & 3; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $251 = $i; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $252 = (($251) + 256)|0; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $253 = $2; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $254 = (($253) + ($252<<2)|0); //@line 252 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$254>>2] = $250; //@line 252 "LatticeCrypto_v1.0/kex.c"
  $255 = ((($v0)) + 8|0); //@line 253 "LatticeCrypto_v1.0/kex.c"
  $256 = HEAP32[$255>>2]|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $257 = ((($v0)) + 12|0); //@line 253 "LatticeCrypto_v1.0/kex.c"
  $258 = HEAP32[$257>>2]|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $259 = (($256) - ($258))|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $260 = $259 & 3; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $261 = $i; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $262 = (($261) + 512)|0; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $263 = $2; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $264 = (($263) + ($262<<2)|0); //@line 253 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$264>>2] = $260; //@line 253 "LatticeCrypto_v1.0/kex.c"
  $265 = ((($v0)) + 12|0); //@line 254 "LatticeCrypto_v1.0/kex.c"
  $266 = HEAP32[$265>>2]|0; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $267 = $266 << 1; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $268 = $norm; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $269 = $268 ^ -1; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $270 = 1 & $269; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $271 = (($267) + ($270))|0; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $272 = $271 & 3; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $273 = $i; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $274 = (($273) + 768)|0; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $275 = $2; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $276 = (($275) + ($274<<2)|0); //@line 254 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$276>>2] = $272; //@line 254 "LatticeCrypto_v1.0/kex.c"
  $277 = $i; //@line 225 "LatticeCrypto_v1.0/kex.c"
  $278 = (($277) + 1)|0; //@line 225 "LatticeCrypto_v1.0/kex.c"
  $i = $278; //@line 225 "LatticeCrypto_v1.0/kex.c"
 }
 $279 = $Status; //@line 258 "LatticeCrypto_v1.0/kex.c"
 $0 = $279; //@line 258 "LatticeCrypto_v1.0/kex.c"
 $280 = $0; //@line 259 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($280|0); //@line 259 "LatticeCrypto_v1.0/kex.c"
}
function _Abs($value) {
 $value = $value|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $mask = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $value;
 $1 = $0; //@line 202 "LatticeCrypto_v1.0/kex.c"
 $2 = $1 >> 31; //@line 202 "LatticeCrypto_v1.0/kex.c"
 $mask = $2; //@line 202 "LatticeCrypto_v1.0/kex.c"
 $3 = $mask; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $4 = $0; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $5 = $3 ^ $4; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $6 = $mask; //@line 203 "LatticeCrypto_v1.0/kex.c"
 $7 = (($5) - ($6))|0; //@line 203 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($7|0); //@line 203 "LatticeCrypto_v1.0/kex.c"
}
function _Rec($x,$rvec,$key) {
 $x = $x|0;
 $rvec = $rvec|0;
 $key = $key|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $i = 0, $t = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $t = sp;
 $0 = $x;
 $1 = $rvec;
 $2 = $key;
 $i = 0; //@line 287 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $3 = $i; //@line 287 "LatticeCrypto_v1.0/kex.c"
  $4 = ($3>>>0)<(32); //@line 287 "LatticeCrypto_v1.0/kex.c"
  if (!($4)) {
   break;
  }
  $5 = $i; //@line 288 "LatticeCrypto_v1.0/kex.c"
  $6 = $2; //@line 288 "LatticeCrypto_v1.0/kex.c"
  $7 = (($6) + ($5)|0); //@line 288 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$7>>0] = 0; //@line 288 "LatticeCrypto_v1.0/kex.c"
  $8 = $i; //@line 287 "LatticeCrypto_v1.0/kex.c"
  $9 = (($8) + 1)|0; //@line 287 "LatticeCrypto_v1.0/kex.c"
  $i = $9; //@line 287 "LatticeCrypto_v1.0/kex.c"
 }
 $i = 0; //@line 290 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $10 = $i; //@line 290 "LatticeCrypto_v1.0/kex.c"
  $11 = ($10>>>0)<(256); //@line 290 "LatticeCrypto_v1.0/kex.c"
  if (!($11)) {
   break;
  }
  $12 = $i; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $13 = $0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $14 = (($13) + ($12<<2)|0); //@line 291 "LatticeCrypto_v1.0/kex.c"
  $15 = HEAP32[$14>>2]|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $16 = $15<<3; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $17 = $i; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $18 = $1; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $19 = (($18) + ($17<<2)|0); //@line 291 "LatticeCrypto_v1.0/kex.c"
  $20 = HEAP32[$19>>2]|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $21 = $20<<1; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $22 = $i; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $23 = (($22) + 768)|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $24 = $1; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $25 = (($24) + ($23<<2)|0); //@line 291 "LatticeCrypto_v1.0/kex.c"
  $26 = HEAP32[$25>>2]|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $27 = (($21) + ($26))|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $28 = ($27*12289)|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $29 = (($16) - ($28))|0; //@line 291 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$t>>2] = $29; //@line 291 "LatticeCrypto_v1.0/kex.c"
  $30 = $i; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $31 = (($30) + 256)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $32 = $0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $33 = (($32) + ($31<<2)|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  $34 = HEAP32[$33>>2]|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $35 = $34<<3; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $36 = $i; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $37 = (($36) + 256)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $38 = $1; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $39 = (($38) + ($37<<2)|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  $40 = HEAP32[$39>>2]|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $41 = $40<<1; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $42 = $i; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $43 = (($42) + 768)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $44 = $1; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $45 = (($44) + ($43<<2)|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  $46 = HEAP32[$45>>2]|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $47 = (($41) + ($46))|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $48 = ($47*12289)|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $49 = (($35) - ($48))|0; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $50 = ((($t)) + 4|0); //@line 292 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$50>>2] = $49; //@line 292 "LatticeCrypto_v1.0/kex.c"
  $51 = $i; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $52 = (($51) + 512)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $53 = $0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $54 = (($53) + ($52<<2)|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  $55 = HEAP32[$54>>2]|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $56 = $55<<3; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $57 = $i; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $58 = (($57) + 512)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $59 = $1; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $60 = (($59) + ($58<<2)|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  $61 = HEAP32[$60>>2]|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $62 = $61<<1; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $63 = $i; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $64 = (($63) + 768)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $65 = $1; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $66 = (($65) + ($64<<2)|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  $67 = HEAP32[$66>>2]|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $68 = (($62) + ($67))|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $69 = ($68*12289)|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $70 = (($56) - ($69))|0; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $71 = ((($t)) + 8|0); //@line 293 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$71>>2] = $70; //@line 293 "LatticeCrypto_v1.0/kex.c"
  $72 = $i; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $73 = (($72) + 768)|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $74 = $0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $75 = (($74) + ($73<<2)|0); //@line 294 "LatticeCrypto_v1.0/kex.c"
  $76 = HEAP32[$75>>2]|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $77 = $76<<3; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $78 = $i; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $79 = (($78) + 768)|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $80 = $1; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $81 = (($80) + ($79<<2)|0); //@line 294 "LatticeCrypto_v1.0/kex.c"
  $82 = HEAP32[$81>>2]|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $83 = ($82*12289)|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $84 = (($77) - ($83))|0; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $85 = ((($t)) + 12|0); //@line 294 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$85>>2] = $84; //@line 294 "LatticeCrypto_v1.0/kex.c"
  $86 = (_LDDecode($t)|0); //@line 296 "LatticeCrypto_v1.0/kex.c"
  $87 = $86&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $88 = $87&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $89 = $i; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $90 = $89 & 7; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $91 = $88 << $90; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $92 = $i; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $93 = $92 >>> 3; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $94 = $2; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $95 = (($94) + ($93)|0); //@line 296 "LatticeCrypto_v1.0/kex.c"
  $96 = HEAP8[$95>>0]|0; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $97 = $96&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $98 = $97 | $91; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $99 = $98&255; //@line 296 "LatticeCrypto_v1.0/kex.c"
  HEAP8[$95>>0] = $99; //@line 296 "LatticeCrypto_v1.0/kex.c"
  $100 = $i; //@line 290 "LatticeCrypto_v1.0/kex.c"
  $101 = (($100) + 1)|0; //@line 290 "LatticeCrypto_v1.0/kex.c"
  $i = $101; //@line 290 "LatticeCrypto_v1.0/kex.c"
 }
 STACKTOP = sp;return; //@line 302 "LatticeCrypto_v1.0/kex.c"
}
function _LDDecode($t) {
 $t = $t|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $cneg = 0, $i = 0;
 var $mask1 = 0, $mask2 = 0, $norm = 0, $value = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $t;
 $norm = 0; //@line 264 "LatticeCrypto_v1.0/kex.c"
 $cneg = -98312; //@line 266 "LatticeCrypto_v1.0/kex.c"
 $i = 0; //@line 268 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $1 = $i; //@line 268 "LatticeCrypto_v1.0/kex.c"
  $2 = ($1>>>0)<(4); //@line 268 "LatticeCrypto_v1.0/kex.c"
  if (!($2)) {
   break;
  }
  $3 = $i; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $4 = $0; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $5 = (($4) + ($3<<2)|0); //@line 269 "LatticeCrypto_v1.0/kex.c"
  $6 = HEAP32[$5>>2]|0; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $7 = $6 >> 31; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $mask1 = $7; //@line 269 "LatticeCrypto_v1.0/kex.c"
  $8 = $i; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $9 = $0; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $10 = (($9) + ($8<<2)|0); //@line 270 "LatticeCrypto_v1.0/kex.c"
  $11 = HEAP32[$10>>2]|0; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $12 = (_Abs($11)|0); //@line 270 "LatticeCrypto_v1.0/kex.c"
  $13 = (49156 - ($12))|0; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $14 = $13 >> 31; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $mask2 = $14; //@line 270 "LatticeCrypto_v1.0/kex.c"
  $15 = $mask1; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $16 = $cneg; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $17 = 98312 ^ $16; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $18 = $15 & $17; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $19 = $cneg; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $20 = $18 ^ $19; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $value = $20; //@line 272 "LatticeCrypto_v1.0/kex.c"
  $21 = $i; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $22 = $0; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $23 = (($22) + ($21<<2)|0); //@line 273 "LatticeCrypto_v1.0/kex.c"
  $24 = HEAP32[$23>>2]|0; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $25 = $mask2; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $26 = $value; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $27 = $25 & $26; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $28 = (($24) + ($27))|0; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $29 = (_Abs($28)|0); //@line 273 "LatticeCrypto_v1.0/kex.c"
  $30 = $norm; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $31 = (($30) + ($29))|0; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $norm = $31; //@line 273 "LatticeCrypto_v1.0/kex.c"
  $32 = $i; //@line 268 "LatticeCrypto_v1.0/kex.c"
  $33 = (($32) + 1)|0; //@line 268 "LatticeCrypto_v1.0/kex.c"
  $i = $33; //@line 268 "LatticeCrypto_v1.0/kex.c"
 }
 $34 = $norm; //@line 276 "LatticeCrypto_v1.0/kex.c"
 $35 = (98312 - ($34))|0; //@line 276 "LatticeCrypto_v1.0/kex.c"
 $36 = $35 >>> 31; //@line 276 "LatticeCrypto_v1.0/kex.c"
 $37 = $36 ^ 1; //@line 276 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($37|0); //@line 276 "LatticeCrypto_v1.0/kex.c"
}
function _get_error($e,$seed,$nonce,$StreamOutputFunction) {
 $e = $e|0;
 $seed = $seed|0;
 $nonce = $nonce|0;
 $StreamOutputFunction = $StreamOutputFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $Status = 0, $acc1 = 0, $acc2 = 0, $i = 0;
 var $j = 0, $nce = 0, $pacc1 = 0, $pacc2 = 0, $pstream = 0, $stream = 0, $temp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 3136|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $stream = sp + 64|0;
 $acc1 = sp + 28|0;
 $acc2 = sp + 24|0;
 $nce = sp + 56|0;
 $1 = $e;
 $2 = $seed;
 $3 = $nonce;
 $4 = $StreamOutputFunction;
 $pstream = $stream; //@line 308 "LatticeCrypto_v1.0/kex.c"
 $pacc1 = $acc1; //@line 310 "LatticeCrypto_v1.0/kex.c"
 $pacc2 = $acc2; //@line 310 "LatticeCrypto_v1.0/kex.c"
 ;HEAP8[$nce>>0]=0|0;HEAP8[$nce+1>>0]=0|0;HEAP8[$nce+2>>0]=0|0;HEAP8[$nce+3>>0]=0|0;HEAP8[$nce+4>>0]=0|0;HEAP8[$nce+5>>0]=0|0;HEAP8[$nce+6>>0]=0|0;HEAP8[$nce+7>>0]=0|0; //@line 311 "LatticeCrypto_v1.0/kex.c"
 $Status = 3; //@line 313 "LatticeCrypto_v1.0/kex.c"
 $5 = $3; //@line 315 "LatticeCrypto_v1.0/kex.c"
 $6 = $5&255; //@line 315 "LatticeCrypto_v1.0/kex.c"
 HEAP8[$nce>>0] = $6; //@line 315 "LatticeCrypto_v1.0/kex.c"
 $7 = $2; //@line 316 "LatticeCrypto_v1.0/kex.c"
 $8 = $4; //@line 316 "LatticeCrypto_v1.0/kex.c"
 $9 = (_stream_output($7,32,$nce,32,3072,$stream,$8)|0); //@line 316 "LatticeCrypto_v1.0/kex.c"
 $Status = $9; //@line 316 "LatticeCrypto_v1.0/kex.c"
 $10 = $Status; //@line 317 "LatticeCrypto_v1.0/kex.c"
 $11 = ($10|0)!=(0); //@line 317 "LatticeCrypto_v1.0/kex.c"
 if ($11) {
  _clear_words($stream,768); //@line 318 "LatticeCrypto_v1.0/kex.c"
  $12 = $Status; //@line 319 "LatticeCrypto_v1.0/kex.c"
  $0 = $12; //@line 319 "LatticeCrypto_v1.0/kex.c"
  $115 = $0; //@line 346 "LatticeCrypto_v1.0/kex.c"
  STACKTOP = sp;return ($115|0); //@line 346 "LatticeCrypto_v1.0/kex.c"
 }
 $i = 0; //@line 325 "LatticeCrypto_v1.0/kex.c"
 while(1) {
  $13 = $i; //@line 325 "LatticeCrypto_v1.0/kex.c"
  $14 = ($13>>>0)<(256); //@line 325 "LatticeCrypto_v1.0/kex.c"
  if (!($14)) {
   break;
  }
  HEAP32[$acc1>>2] = 0; //@line 327 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$acc2>>2] = 0; //@line 328 "LatticeCrypto_v1.0/kex.c"
  $j = 0; //@line 329 "LatticeCrypto_v1.0/kex.c"
  while(1) {
   $15 = $j; //@line 329 "LatticeCrypto_v1.0/kex.c"
   $16 = ($15>>>0)<(8); //@line 329 "LatticeCrypto_v1.0/kex.c"
   if (!($16)) {
    break;
   }
   $17 = $i; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $18 = $pstream; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $19 = (($18) + ($17<<2)|0); //@line 330 "LatticeCrypto_v1.0/kex.c"
   $20 = HEAP32[$19>>2]|0; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $21 = $j; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $22 = $20 >>> $21; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $23 = $22 & 16843009; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $24 = HEAP32[$acc1>>2]|0; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $25 = (($24) + ($23))|0; //@line 330 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$acc1>>2] = $25; //@line 330 "LatticeCrypto_v1.0/kex.c"
   $26 = $i; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $27 = (($26) + 256)|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $28 = $pstream; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $29 = (($28) + ($27<<2)|0); //@line 331 "LatticeCrypto_v1.0/kex.c"
   $30 = HEAP32[$29>>2]|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $31 = $j; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $32 = $30 >>> $31; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $33 = $32 & 16843009; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $34 = HEAP32[$acc2>>2]|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $35 = (($34) + ($33))|0; //@line 331 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$acc2>>2] = $35; //@line 331 "LatticeCrypto_v1.0/kex.c"
   $36 = $j; //@line 329 "LatticeCrypto_v1.0/kex.c"
   $37 = (($36) + 1)|0; //@line 329 "LatticeCrypto_v1.0/kex.c"
   $j = $37; //@line 329 "LatticeCrypto_v1.0/kex.c"
  }
  $j = 0; //@line 333 "LatticeCrypto_v1.0/kex.c"
  while(1) {
   $38 = $j; //@line 333 "LatticeCrypto_v1.0/kex.c"
   $39 = ($38>>>0)<(4); //@line 333 "LatticeCrypto_v1.0/kex.c"
   if (!($39)) {
    break;
   }
   $40 = $i; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $41 = (($40) + 512)|0; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $42 = $pstream; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $43 = (($42) + ($41<<2)|0); //@line 334 "LatticeCrypto_v1.0/kex.c"
   $44 = HEAP32[$43>>2]|0; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $45 = $j; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $46 = $44 >>> $45; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $temp = $46; //@line 334 "LatticeCrypto_v1.0/kex.c"
   $47 = $temp; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $48 = $47 & 16843009; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $49 = HEAP32[$acc1>>2]|0; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $50 = (($49) + ($48))|0; //@line 335 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$acc1>>2] = $50; //@line 335 "LatticeCrypto_v1.0/kex.c"
   $51 = $temp; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $52 = $51 >>> 4; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $53 = $52 & 16843009; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $54 = HEAP32[$acc2>>2]|0; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $55 = (($54) + ($53))|0; //@line 336 "LatticeCrypto_v1.0/kex.c"
   HEAP32[$acc2>>2] = $55; //@line 336 "LatticeCrypto_v1.0/kex.c"
   $56 = $j; //@line 333 "LatticeCrypto_v1.0/kex.c"
   $57 = (($56) + 1)|0; //@line 333 "LatticeCrypto_v1.0/kex.c"
   $j = $57; //@line 333 "LatticeCrypto_v1.0/kex.c"
  }
  $58 = $pacc1; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $59 = HEAP8[$58>>0]|0; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $60 = $59&255; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $61 = $pacc1; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $62 = ((($61)) + 1|0); //@line 338 "LatticeCrypto_v1.0/kex.c"
  $63 = HEAP8[$62>>0]|0; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $64 = $63&255; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $65 = (($60) - ($64))|0; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $66 = $i; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $67 = $66<<1; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $68 = $1; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $69 = (($68) + ($67<<2)|0); //@line 338 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$69>>2] = $65; //@line 338 "LatticeCrypto_v1.0/kex.c"
  $70 = $pacc1; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $71 = ((($70)) + 2|0); //@line 339 "LatticeCrypto_v1.0/kex.c"
  $72 = HEAP8[$71>>0]|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $73 = $72&255; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $74 = $pacc1; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $75 = ((($74)) + 3|0); //@line 339 "LatticeCrypto_v1.0/kex.c"
  $76 = HEAP8[$75>>0]|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $77 = $76&255; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $78 = (($73) - ($77))|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $79 = $i; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $80 = $79<<1; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $81 = (($80) + 1)|0; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $82 = $1; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $83 = (($82) + ($81<<2)|0); //@line 339 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$83>>2] = $78; //@line 339 "LatticeCrypto_v1.0/kex.c"
  $84 = $pacc2; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $85 = HEAP8[$84>>0]|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $86 = $85&255; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $87 = $pacc2; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $88 = ((($87)) + 1|0); //@line 340 "LatticeCrypto_v1.0/kex.c"
  $89 = HEAP8[$88>>0]|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $90 = $89&255; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $91 = (($86) - ($90))|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $92 = $i; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $93 = $92<<1; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $94 = (($93) + 512)|0; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $95 = $1; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $96 = (($95) + ($94<<2)|0); //@line 340 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$96>>2] = $91; //@line 340 "LatticeCrypto_v1.0/kex.c"
  $97 = $pacc2; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $98 = ((($97)) + 2|0); //@line 341 "LatticeCrypto_v1.0/kex.c"
  $99 = HEAP8[$98>>0]|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $100 = $99&255; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $101 = $pacc2; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $102 = ((($101)) + 3|0); //@line 341 "LatticeCrypto_v1.0/kex.c"
  $103 = HEAP8[$102>>0]|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $104 = $103&255; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $105 = (($100) - ($104))|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $106 = $i; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $107 = $106<<1; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $108 = (($107) + 512)|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $109 = (($108) + 1)|0; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $110 = $1; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $111 = (($110) + ($109<<2)|0); //@line 341 "LatticeCrypto_v1.0/kex.c"
  HEAP32[$111>>2] = $105; //@line 341 "LatticeCrypto_v1.0/kex.c"
  $112 = $i; //@line 325 "LatticeCrypto_v1.0/kex.c"
  $113 = (($112) + 1)|0; //@line 325 "LatticeCrypto_v1.0/kex.c"
  $i = $113; //@line 325 "LatticeCrypto_v1.0/kex.c"
 }
 $114 = $Status; //@line 345 "LatticeCrypto_v1.0/kex.c"
 $0 = $114; //@line 345 "LatticeCrypto_v1.0/kex.c"
 $115 = $0; //@line 346 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($115|0); //@line 346 "LatticeCrypto_v1.0/kex.c"
}
function _generate_a($a,$seed,$ExtendableOutputFunction) {
 $a = $a|0;
 $seed = $seed|0;
 $ExtendableOutputFunction = $ExtendableOutputFunction|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $a;
 $1 = $seed;
 $2 = $ExtendableOutputFunction;
 $3 = $1; //@line 352 "LatticeCrypto_v1.0/kex.c"
 $4 = $0; //@line 352 "LatticeCrypto_v1.0/kex.c"
 $5 = $2; //@line 352 "LatticeCrypto_v1.0/kex.c"
 $6 = (_extended_output($3,32,1024,$4,$5)|0); //@line 352 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($6|0); //@line 352 "LatticeCrypto_v1.0/kex.c"
}
function _KeyGeneration_A($SecretKeyA,$PublicKeyA,$pLatticeCrypto) {
 $SecretKeyA = $SecretKeyA|0;
 $PublicKeyA = $PublicKeyA|0;
 $pLatticeCrypto = $pLatticeCrypto|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $Status = 0;
 var $a = 0, $e = 0, $error_seed = 0, $seed = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 8288|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $a = sp + 4104|0;
 $e = sp + 8|0;
 $seed = sp + 8248|0;
 $error_seed = sp + 8216|0;
 $1 = $SecretKeyA;
 $2 = $PublicKeyA;
 $3 = $pLatticeCrypto;
 $Status = 3; //@line 365 "LatticeCrypto_v1.0/kex.c"
 $4 = $3; //@line 367 "LatticeCrypto_v1.0/kex.c"
 $5 = HEAP32[$4>>2]|0; //@line 367 "LatticeCrypto_v1.0/kex.c"
 $6 = (_random_bytes(32,$seed,$5)|0); //@line 367 "LatticeCrypto_v1.0/kex.c"
 $Status = $6; //@line 367 "LatticeCrypto_v1.0/kex.c"
 $7 = $Status; //@line 368 "LatticeCrypto_v1.0/kex.c"
 $8 = ($7|0)!=(0); //@line 368 "LatticeCrypto_v1.0/kex.c"
 if ($8) {
  $9 = $Status; //@line 369 "LatticeCrypto_v1.0/kex.c"
  $0 = $9; //@line 369 "LatticeCrypto_v1.0/kex.c"
  $38 = $0; //@line 402 "LatticeCrypto_v1.0/kex.c"
  STACKTOP = sp;return ($38|0); //@line 402 "LatticeCrypto_v1.0/kex.c"
 }
 $10 = $3; //@line 371 "LatticeCrypto_v1.0/kex.c"
 $11 = HEAP32[$10>>2]|0; //@line 371 "LatticeCrypto_v1.0/kex.c"
 $12 = (_random_bytes(32,$error_seed,$11)|0); //@line 371 "LatticeCrypto_v1.0/kex.c"
 $Status = $12; //@line 371 "LatticeCrypto_v1.0/kex.c"
 $13 = $Status; //@line 372 "LatticeCrypto_v1.0/kex.c"
 $14 = ($13|0)!=(0); //@line 372 "LatticeCrypto_v1.0/kex.c"
 if (!($14)) {
  $15 = $3; //@line 376 "LatticeCrypto_v1.0/kex.c"
  $16 = ((($15)) + 4|0); //@line 376 "LatticeCrypto_v1.0/kex.c"
  $17 = HEAP32[$16>>2]|0; //@line 376 "LatticeCrypto_v1.0/kex.c"
  $18 = (_generate_a($a,$seed,$17)|0); //@line 376 "LatticeCrypto_v1.0/kex.c"
  $Status = $18; //@line 376 "LatticeCrypto_v1.0/kex.c"
  $19 = $Status; //@line 377 "LatticeCrypto_v1.0/kex.c"
  $20 = ($19|0)!=(0); //@line 377 "LatticeCrypto_v1.0/kex.c"
  if (!($20)) {
   $21 = $1; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $22 = $3; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $23 = ((($22)) + 8|0); //@line 381 "LatticeCrypto_v1.0/kex.c"
   $24 = HEAP32[$23>>2]|0; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $25 = (_get_error($21,$error_seed,0,$24)|0); //@line 381 "LatticeCrypto_v1.0/kex.c"
   $Status = $25; //@line 381 "LatticeCrypto_v1.0/kex.c"
   $26 = $Status; //@line 382 "LatticeCrypto_v1.0/kex.c"
   $27 = ($26|0)!=(0); //@line 382 "LatticeCrypto_v1.0/kex.c"
   if (!($27)) {
    $28 = $3; //@line 385 "LatticeCrypto_v1.0/kex.c"
    $29 = ((($28)) + 8|0); //@line 385 "LatticeCrypto_v1.0/kex.c"
    $30 = HEAP32[$29>>2]|0; //@line 385 "LatticeCrypto_v1.0/kex.c"
    $31 = (_get_error($e,$error_seed,1,$30)|0); //@line 385 "LatticeCrypto_v1.0/kex.c"
    $Status = $31; //@line 385 "LatticeCrypto_v1.0/kex.c"
    $32 = $Status; //@line 386 "LatticeCrypto_v1.0/kex.c"
    $33 = ($32|0)!=(0); //@line 386 "LatticeCrypto_v1.0/kex.c"
    if (!($33)) {
     $34 = $1; //@line 389 "LatticeCrypto_v1.0/kex.c"
     _NTT_CT_std2rev_12289($34,36,1024); //@line 389 "LatticeCrypto_v1.0/kex.c"
     _NTT_CT_std2rev_12289($e,36,1024); //@line 390 "LatticeCrypto_v1.0/kex.c"
     _smul($e,3,1024); //@line 391 "LatticeCrypto_v1.0/kex.c"
     $35 = $1; //@line 393 "LatticeCrypto_v1.0/kex.c"
     _pmuladd($a,$35,$e,$a,1024); //@line 393 "LatticeCrypto_v1.0/kex.c"
     _correction($a,12289,1024); //@line 394 "LatticeCrypto_v1.0/kex.c"
     $36 = $2; //@line 395 "LatticeCrypto_v1.0/kex.c"
     _encode_A($a,$seed,$36); //@line 395 "LatticeCrypto_v1.0/kex.c"
    }
   }
  }
 }
 _clear_words($e,1024); //@line 398 "LatticeCrypto_v1.0/kex.c"
 _clear_words($error_seed,8); //@line 399 "LatticeCrypto_v1.0/kex.c"
 $37 = $Status; //@line 401 "LatticeCrypto_v1.0/kex.c"
 $0 = $37; //@line 401 "LatticeCrypto_v1.0/kex.c"
 $38 = $0; //@line 402 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($38|0); //@line 402 "LatticeCrypto_v1.0/kex.c"
}
function _SecretAgreement_B($PublicKeyA,$SharedSecretB,$PublicKeyB,$pLatticeCrypto) {
 $PublicKeyA = $PublicKeyA|0;
 $SharedSecretB = $SharedSecretB|0;
 $PublicKeyB = $PublicKeyB|0;
 $pLatticeCrypto = $pLatticeCrypto|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $Status = 0, $a = 0, $e = 0, $error_seed = 0, $pk_A = 0, $r = 0, $seed = 0, $sk_B = 0, $v = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 24672|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $pk_A = sp + 20488|0;
 $a = sp + 16392|0;
 $v = sp + 12296|0;
 $r = sp + 8200|0;
 $sk_B = sp + 4104|0;
 $e = sp + 8|0;
 $seed = sp + 24632|0;
 $error_seed = sp + 24600|0;
 $0 = $PublicKeyA;
 $1 = $SharedSecretB;
 $2 = $PublicKeyB;
 $3 = $pLatticeCrypto;
 $Status = 3; //@line 416 "LatticeCrypto_v1.0/kex.c"
 $4 = $0; //@line 418 "LatticeCrypto_v1.0/kex.c"
 _decode_A($4,$pk_A,$seed); //@line 418 "LatticeCrypto_v1.0/kex.c"
 $5 = $3; //@line 419 "LatticeCrypto_v1.0/kex.c"
 $6 = HEAP32[$5>>2]|0; //@line 419 "LatticeCrypto_v1.0/kex.c"
 $7 = (_random_bytes(32,$error_seed,$6)|0); //@line 419 "LatticeCrypto_v1.0/kex.c"
 $Status = $7; //@line 419 "LatticeCrypto_v1.0/kex.c"
 $8 = $Status; //@line 420 "LatticeCrypto_v1.0/kex.c"
 $9 = ($8|0)!=(0); //@line 420 "LatticeCrypto_v1.0/kex.c"
 if (!($9)) {
  $10 = $3; //@line 424 "LatticeCrypto_v1.0/kex.c"
  $11 = ((($10)) + 4|0); //@line 424 "LatticeCrypto_v1.0/kex.c"
  $12 = HEAP32[$11>>2]|0; //@line 424 "LatticeCrypto_v1.0/kex.c"
  $13 = (_generate_a($a,$seed,$12)|0); //@line 424 "LatticeCrypto_v1.0/kex.c"
  $Status = $13; //@line 424 "LatticeCrypto_v1.0/kex.c"
  $14 = $Status; //@line 425 "LatticeCrypto_v1.0/kex.c"
  $15 = ($14|0)!=(0); //@line 425 "LatticeCrypto_v1.0/kex.c"
  if (!($15)) {
   $16 = $3; //@line 429 "LatticeCrypto_v1.0/kex.c"
   $17 = ((($16)) + 8|0); //@line 429 "LatticeCrypto_v1.0/kex.c"
   $18 = HEAP32[$17>>2]|0; //@line 429 "LatticeCrypto_v1.0/kex.c"
   $19 = (_get_error($sk_B,$error_seed,0,$18)|0); //@line 429 "LatticeCrypto_v1.0/kex.c"
   $Status = $19; //@line 429 "LatticeCrypto_v1.0/kex.c"
   $20 = $Status; //@line 430 "LatticeCrypto_v1.0/kex.c"
   $21 = ($20|0)!=(0); //@line 430 "LatticeCrypto_v1.0/kex.c"
   if (!($21)) {
    $22 = $3; //@line 433 "LatticeCrypto_v1.0/kex.c"
    $23 = ((($22)) + 8|0); //@line 433 "LatticeCrypto_v1.0/kex.c"
    $24 = HEAP32[$23>>2]|0; //@line 433 "LatticeCrypto_v1.0/kex.c"
    $25 = (_get_error($e,$error_seed,1,$24)|0); //@line 433 "LatticeCrypto_v1.0/kex.c"
    $Status = $25; //@line 433 "LatticeCrypto_v1.0/kex.c"
    $26 = $Status; //@line 434 "LatticeCrypto_v1.0/kex.c"
    $27 = ($26|0)!=(0); //@line 434 "LatticeCrypto_v1.0/kex.c"
    if (!($27)) {
     _NTT_CT_std2rev_12289($sk_B,36,1024); //@line 437 "LatticeCrypto_v1.0/kex.c"
     _NTT_CT_std2rev_12289($e,36,1024); //@line 438 "LatticeCrypto_v1.0/kex.c"
     _smul($e,3,1024); //@line 439 "LatticeCrypto_v1.0/kex.c"
     _pmuladd($a,$sk_B,$e,$a,1024); //@line 441 "LatticeCrypto_v1.0/kex.c"
     _correction($a,12289,1024); //@line 442 "LatticeCrypto_v1.0/kex.c"
     $28 = $3; //@line 444 "LatticeCrypto_v1.0/kex.c"
     $29 = ((($28)) + 8|0); //@line 444 "LatticeCrypto_v1.0/kex.c"
     $30 = HEAP32[$29>>2]|0; //@line 444 "LatticeCrypto_v1.0/kex.c"
     $31 = (_get_error($e,$error_seed,2,$30)|0); //@line 444 "LatticeCrypto_v1.0/kex.c"
     $Status = $31; //@line 444 "LatticeCrypto_v1.0/kex.c"
     $32 = $Status; //@line 445 "LatticeCrypto_v1.0/kex.c"
     $33 = ($32|0)!=(0); //@line 445 "LatticeCrypto_v1.0/kex.c"
     if (!($33)) {
      _NTT_CT_std2rev_12289($e,36,1024); //@line 448 "LatticeCrypto_v1.0/kex.c"
      _smul($e,81,1024); //@line 449 "LatticeCrypto_v1.0/kex.c"
      _pmuladd($pk_A,$sk_B,$e,$v,1024); //@line 451 "LatticeCrypto_v1.0/kex.c"
      $34 = HEAP32[8]|0; //@line 452 "LatticeCrypto_v1.0/kex.c"
      $35 = HEAP32[7]|0; //@line 452 "LatticeCrypto_v1.0/kex.c"
      _INTT_GS_rev2std_12289($v,4132,$34,$35,1024); //@line 452 "LatticeCrypto_v1.0/kex.c"
      _two_reduce12289($v,1024); //@line 453 "LatticeCrypto_v1.0/kex.c"
      _correction($v,12289,1024); //@line 455 "LatticeCrypto_v1.0/kex.c"
      $36 = $3; //@line 458 "LatticeCrypto_v1.0/kex.c"
      $37 = ((($36)) + 8|0); //@line 458 "LatticeCrypto_v1.0/kex.c"
      $38 = HEAP32[$37>>2]|0; //@line 458 "LatticeCrypto_v1.0/kex.c"
      $39 = (_HelpRec($v,$r,$error_seed,3,$38)|0); //@line 458 "LatticeCrypto_v1.0/kex.c"
      $Status = $39; //@line 458 "LatticeCrypto_v1.0/kex.c"
      $40 = $Status; //@line 459 "LatticeCrypto_v1.0/kex.c"
      $41 = ($40|0)!=(0); //@line 459 "LatticeCrypto_v1.0/kex.c"
      if (!($41)) {
       $42 = $1; //@line 462 "LatticeCrypto_v1.0/kex.c"
       _Rec($v,$r,$42); //@line 462 "LatticeCrypto_v1.0/kex.c"
       $43 = $2; //@line 463 "LatticeCrypto_v1.0/kex.c"
       _encode_B($a,$r,$43); //@line 463 "LatticeCrypto_v1.0/kex.c"
      }
     }
    }
   }
  }
 }
 _clear_words($sk_B,1024); //@line 466 "LatticeCrypto_v1.0/kex.c"
 _clear_words($e,1024); //@line 467 "LatticeCrypto_v1.0/kex.c"
 _clear_words($error_seed,8); //@line 468 "LatticeCrypto_v1.0/kex.c"
 _clear_words($a,1024); //@line 469 "LatticeCrypto_v1.0/kex.c"
 _clear_words($v,1024); //@line 470 "LatticeCrypto_v1.0/kex.c"
 _clear_words($r,1024); //@line 471 "LatticeCrypto_v1.0/kex.c"
 $44 = $Status; //@line 473 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($44|0); //@line 473 "LatticeCrypto_v1.0/kex.c"
}
function _SecretAgreement_A($PublicKeyB,$SecretKeyA,$SharedSecretA) {
 $PublicKeyB = $PublicKeyB|0;
 $SecretKeyA = $SecretKeyA|0;
 $SharedSecretA = $SharedSecretA|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $Status = 0, $r = 0, $u = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 8224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $u = sp + 4104|0;
 $r = sp + 8|0;
 $0 = $PublicKeyB;
 $1 = $SecretKeyA;
 $2 = $SharedSecretA;
 $Status = 0; //@line 485 "LatticeCrypto_v1.0/kex.c"
 $3 = $0; //@line 487 "LatticeCrypto_v1.0/kex.c"
 _decode_B($3,$u,$r); //@line 487 "LatticeCrypto_v1.0/kex.c"
 $4 = $1; //@line 489 "LatticeCrypto_v1.0/kex.c"
 _pmul($4,$u,$u,1024); //@line 489 "LatticeCrypto_v1.0/kex.c"
 $5 = HEAP32[8]|0; //@line 490 "LatticeCrypto_v1.0/kex.c"
 $6 = HEAP32[7]|0; //@line 490 "LatticeCrypto_v1.0/kex.c"
 _INTT_GS_rev2std_12289($u,4132,$5,$6,1024); //@line 490 "LatticeCrypto_v1.0/kex.c"
 _two_reduce12289($u,1024); //@line 491 "LatticeCrypto_v1.0/kex.c"
 _correction($u,12289,1024); //@line 493 "LatticeCrypto_v1.0/kex.c"
 $7 = $2; //@line 496 "LatticeCrypto_v1.0/kex.c"
 _Rec($u,$r,$7); //@line 496 "LatticeCrypto_v1.0/kex.c"
 _clear_words($u,1024); //@line 499 "LatticeCrypto_v1.0/kex.c"
 _clear_words($r,1024); //@line 500 "LatticeCrypto_v1.0/kex.c"
 $8 = $Status; //@line 502 "LatticeCrypto_v1.0/kex.c"
 STACKTOP = sp;return ($8|0); //@line 502 "LatticeCrypto_v1.0/kex.c"
}
function _random_bytes($nbytes,$random_array,$RandomBytesFunction) {
 $nbytes = $nbytes|0;
 $random_array = $random_array|0;
 $RandomBytesFunction = $RandomBytesFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $nbytes;
 $2 = $random_array;
 $3 = $RandomBytesFunction;
 $4 = $2; //@line 20 "LatticeCrypto_v1.0/random.c"
 $5 = ($4|0)==(0|0); //@line 20 "LatticeCrypto_v1.0/random.c"
 $6 = $3; //@line 20 "LatticeCrypto_v1.0/random.c"
 $7 = ($6|0)==(0|0); //@line 20 "LatticeCrypto_v1.0/random.c"
 $or$cond = $5 | $7; //@line 20 "LatticeCrypto_v1.0/random.c"
 $8 = $1; //@line 20 "LatticeCrypto_v1.0/random.c"
 $9 = ($8|0)==(0); //@line 20 "LatticeCrypto_v1.0/random.c"
 $or$cond3 = $or$cond | $9; //@line 20 "LatticeCrypto_v1.0/random.c"
 if ($or$cond3) {
  $0 = 6; //@line 21 "LatticeCrypto_v1.0/random.c"
  $14 = $0; //@line 25 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($14|0); //@line 25 "LatticeCrypto_v1.0/random.c"
 } else {
  $10 = $3; //@line 24 "LatticeCrypto_v1.0/random.c"
  $11 = $1; //@line 24 "LatticeCrypto_v1.0/random.c"
  $12 = $2; //@line 24 "LatticeCrypto_v1.0/random.c"
  $13 = (FUNCTION_TABLE_iii[$10 & 31]($11,$12)|0); //@line 24 "LatticeCrypto_v1.0/random.c"
  $0 = $13; //@line 24 "LatticeCrypto_v1.0/random.c"
  $14 = $0; //@line 25 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($14|0); //@line 25 "LatticeCrypto_v1.0/random.c"
 }
 return (0)|0;
}
function _extended_output($seed,$seed_nbytes,$array_ndigits,$extended_array,$ExtendableOutputFunction) {
 $seed = $seed|0;
 $seed_nbytes = $seed_nbytes|0;
 $array_ndigits = $array_ndigits|0;
 $extended_array = $extended_array|0;
 $ExtendableOutputFunction = $ExtendableOutputFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, $or$cond7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $seed;
 $2 = $seed_nbytes;
 $3 = $array_ndigits;
 $4 = $extended_array;
 $5 = $ExtendableOutputFunction;
 $6 = $1; //@line 33 "LatticeCrypto_v1.0/random.c"
 $7 = ($6|0)==(0|0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $8 = $4; //@line 33 "LatticeCrypto_v1.0/random.c"
 $9 = ($8|0)==(0|0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond = $7 | $9; //@line 33 "LatticeCrypto_v1.0/random.c"
 $10 = $5; //@line 33 "LatticeCrypto_v1.0/random.c"
 $11 = ($10|0)==(0|0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond3 = $or$cond | $11; //@line 33 "LatticeCrypto_v1.0/random.c"
 $12 = $2; //@line 33 "LatticeCrypto_v1.0/random.c"
 $13 = ($12|0)==(0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond5 = $or$cond3 | $13; //@line 33 "LatticeCrypto_v1.0/random.c"
 $14 = $3; //@line 33 "LatticeCrypto_v1.0/random.c"
 $15 = ($14|0)==(0); //@line 33 "LatticeCrypto_v1.0/random.c"
 $or$cond7 = $or$cond5 | $15; //@line 33 "LatticeCrypto_v1.0/random.c"
 if ($or$cond7) {
  $0 = 6; //@line 34 "LatticeCrypto_v1.0/random.c"
  $22 = $0; //@line 38 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($22|0); //@line 38 "LatticeCrypto_v1.0/random.c"
 } else {
  $16 = $5; //@line 37 "LatticeCrypto_v1.0/random.c"
  $17 = $1; //@line 37 "LatticeCrypto_v1.0/random.c"
  $18 = $2; //@line 37 "LatticeCrypto_v1.0/random.c"
  $19 = $3; //@line 37 "LatticeCrypto_v1.0/random.c"
  $20 = $4; //@line 37 "LatticeCrypto_v1.0/random.c"
  $21 = (FUNCTION_TABLE_iiiii[$16 & 31]($17,$18,$19,$20)|0); //@line 37 "LatticeCrypto_v1.0/random.c"
  $0 = $21; //@line 37 "LatticeCrypto_v1.0/random.c"
  $22 = $0; //@line 38 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($22|0); //@line 38 "LatticeCrypto_v1.0/random.c"
 }
 return (0)|0;
}
function _stream_output($seed,$seed_nbytes,$nonce,$nonce_nbytes,$array_nbytes,$stream_array,$StreamOutputFunction) {
 $seed = $seed|0;
 $seed_nbytes = $seed_nbytes|0;
 $nonce = $nonce|0;
 $nonce_nbytes = $nonce_nbytes|0;
 $array_nbytes = $array_nbytes|0;
 $stream_array = $stream_array|0;
 $StreamOutputFunction = $StreamOutputFunction|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, $or$cond5 = 0, $or$cond7 = 0, $or$cond9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $seed;
 $2 = $seed_nbytes;
 $3 = $nonce;
 $4 = $nonce_nbytes;
 $5 = $array_nbytes;
 $6 = $stream_array;
 $7 = $StreamOutputFunction;
 $8 = $1; //@line 46 "LatticeCrypto_v1.0/random.c"
 $9 = ($8|0)==(0|0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $10 = $6; //@line 46 "LatticeCrypto_v1.0/random.c"
 $11 = ($10|0)==(0|0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond = $9 | $11; //@line 46 "LatticeCrypto_v1.0/random.c"
 $12 = $7; //@line 46 "LatticeCrypto_v1.0/random.c"
 $13 = ($12|0)==(0|0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond3 = $or$cond | $13; //@line 46 "LatticeCrypto_v1.0/random.c"
 $14 = $2; //@line 46 "LatticeCrypto_v1.0/random.c"
 $15 = ($14|0)==(0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond5 = $or$cond3 | $15; //@line 46 "LatticeCrypto_v1.0/random.c"
 $16 = $4; //@line 46 "LatticeCrypto_v1.0/random.c"
 $17 = ($16|0)==(0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond7 = $or$cond5 | $17; //@line 46 "LatticeCrypto_v1.0/random.c"
 $18 = $5; //@line 46 "LatticeCrypto_v1.0/random.c"
 $19 = ($18|0)==(0); //@line 46 "LatticeCrypto_v1.0/random.c"
 $or$cond9 = $or$cond7 | $19; //@line 46 "LatticeCrypto_v1.0/random.c"
 if ($or$cond9) {
  $0 = 6; //@line 47 "LatticeCrypto_v1.0/random.c"
  $28 = $0; //@line 51 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($28|0); //@line 51 "LatticeCrypto_v1.0/random.c"
 } else {
  $20 = $7; //@line 50 "LatticeCrypto_v1.0/random.c"
  $21 = $1; //@line 50 "LatticeCrypto_v1.0/random.c"
  $22 = $2; //@line 50 "LatticeCrypto_v1.0/random.c"
  $23 = $3; //@line 50 "LatticeCrypto_v1.0/random.c"
  $24 = $4; //@line 50 "LatticeCrypto_v1.0/random.c"
  $25 = $5; //@line 50 "LatticeCrypto_v1.0/random.c"
  $26 = $6; //@line 50 "LatticeCrypto_v1.0/random.c"
  $27 = (FUNCTION_TABLE_iiiiiii[$20 & 31]($21,$22,$23,$24,$25,$26)|0); //@line 50 "LatticeCrypto_v1.0/random.c"
  $0 = $27; //@line 50 "LatticeCrypto_v1.0/random.c"
  $28 = $0; //@line 51 "LatticeCrypto_v1.0/random.c"
  STACKTOP = sp;return ($28|0); //@line 51 "LatticeCrypto_v1.0/random.c"
 }
 return (0)|0;
}
function _rlwejs_randombytes($nbytes,$random_array) {
 $nbytes = $nbytes|0;
 $random_array = $random_array|0;
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $nbytes;
 $1 = $random_array;
 $2 = $1; //@line 18 "rlwe.c"
 $3 = $0; //@line 18 "rlwe.c"
 _randombytes_buf($2,$3); //@line 18 "rlwe.c"
 STACKTOP = sp;return 0; //@line 19 "rlwe.c"
}
function _rlwejs_streamoutput($seed,$seed_nbytes,$nonce,$nonce_nbytes,$array_nbytes,$stream_array) {
 $seed = $seed|0;
 $seed_nbytes = $seed_nbytes|0;
 $nonce = $nonce|0;
 $nonce_nbytes = $nonce_nbytes|0;
 $array_nbytes = $array_nbytes|0;
 $stream_array = $stream_array|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $k = 0, $n = 0, $status = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $seed;
 $2 = $seed_nbytes;
 $3 = $nonce;
 $4 = $nonce_nbytes;
 $5 = $array_nbytes;
 $6 = $stream_array;
 $7 = $1; //@line 30 "rlwe.c"
 $k = $7; //@line 30 "rlwe.c"
 $8 = $2; //@line 31 "rlwe.c"
 $9 = ($8>>>0)<(32); //@line 31 "rlwe.c"
 if ($9) {
  $10 = (_calloc(32,1)|0); //@line 32 "rlwe.c"
  $k = $10; //@line 32 "rlwe.c"
  $11 = $2; //@line 33 "rlwe.c"
  $12 = ($11>>>0)>(0); //@line 33 "rlwe.c"
  if ($12) {
   $13 = $k; //@line 34 "rlwe.c"
   $14 = $1; //@line 34 "rlwe.c"
   $15 = $2; //@line 34 "rlwe.c"
   _memcpy(($13|0),($14|0),($15|0))|0; //@line 34 "rlwe.c"
  }
 }
 $16 = $3; //@line 38 "rlwe.c"
 $n = $16; //@line 38 "rlwe.c"
 $17 = $4; //@line 39 "rlwe.c"
 $18 = ($17>>>0)<(8); //@line 39 "rlwe.c"
 if ($18) {
  $19 = (_calloc(8,1)|0); //@line 40 "rlwe.c"
  $n = $19; //@line 40 "rlwe.c"
  $20 = $4; //@line 41 "rlwe.c"
  $21 = ($20>>>0)>(0); //@line 41 "rlwe.c"
  if ($21) {
   $22 = $n; //@line 42 "rlwe.c"
   $23 = $3; //@line 42 "rlwe.c"
   $24 = $4; //@line 42 "rlwe.c"
   _memcpy(($22|0),($23|0),($24|0))|0; //@line 42 "rlwe.c"
  }
 }
 $25 = $6; //@line 46 "rlwe.c"
 $26 = $5; //@line 46 "rlwe.c"
 $27 = $n; //@line 46 "rlwe.c"
 $28 = $k; //@line 46 "rlwe.c"
 $29 = (_crypto_stream_chacha20($25,$26,0,$27,$28)|0); //@line 46 "rlwe.c"
 $status = $29; //@line 46 "rlwe.c"
 $30 = $k; //@line 48 "rlwe.c"
 $31 = $1; //@line 48 "rlwe.c"
 $32 = ($30|0)!=($31|0); //@line 48 "rlwe.c"
 if ($32) {
  $33 = $k; //@line 49 "rlwe.c"
  _sodium_memzero($33,32); //@line 49 "rlwe.c"
  $34 = $k; //@line 50 "rlwe.c"
  _free($34); //@line 50 "rlwe.c"
 }
 $35 = $n; //@line 53 "rlwe.c"
 $36 = $3; //@line 53 "rlwe.c"
 $37 = ($35|0)!=($36|0); //@line 53 "rlwe.c"
 if ($37) {
  $38 = $n; //@line 54 "rlwe.c"
  _sodium_memzero($38,8); //@line 54 "rlwe.c"
  $39 = $n; //@line 55 "rlwe.c"
  _free($39); //@line 55 "rlwe.c"
 }
 $40 = $status; //@line 58 "rlwe.c"
 $41 = ($40|0)!=(0); //@line 58 "rlwe.c"
 if ($41) {
  $0 = 3; //@line 59 "rlwe.c"
  $42 = $0; //@line 63 "rlwe.c"
  STACKTOP = sp;return ($42|0); //@line 63 "rlwe.c"
 } else {
  $0 = 0; //@line 62 "rlwe.c"
  $42 = $0; //@line 63 "rlwe.c"
  STACKTOP = sp;return ($42|0); //@line 63 "rlwe.c"
 }
 return (0)|0;
}
function _rlwejs_extendableoutput($seed,$seed_nbytes,$array_ndigits,$extended_array) {
 $seed = $seed|0;
 $seed_nbytes = $seed_nbytes|0;
 $array_ndigits = $array_ndigits|0;
 $extended_array = $extended_array|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $i = 0, $status = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $seed;
 $2 = $seed_nbytes;
 $3 = $array_ndigits;
 $4 = $extended_array;
 $5 = $1; //@line 72 "rlwe.c"
 $6 = $2; //@line 73 "rlwe.c"
 $7 = $3; //@line 76 "rlwe.c"
 $8 = $7<<2; //@line 76 "rlwe.c"
 $9 = $4; //@line 77 "rlwe.c"
 $10 = (_rlwejs_streamoutput($5,$6,0,0,$8,$9)|0); //@line 71 "rlwe.c"
 $status = $10; //@line 71 "rlwe.c"
 $11 = $status; //@line 80 "rlwe.c"
 $12 = ($11|0)!=(0); //@line 80 "rlwe.c"
 if ($12) {
  $13 = $status; //@line 81 "rlwe.c"
  $0 = $13; //@line 81 "rlwe.c"
  $27 = $0; //@line 89 "rlwe.c"
  STACKTOP = sp;return ($27|0); //@line 89 "rlwe.c"
 }
 $i = 0; //@line 84 "rlwe.c"
 while(1) {
  $14 = $i; //@line 84 "rlwe.c"
  $15 = $3; //@line 84 "rlwe.c"
  $16 = ($14>>>0)<($15>>>0); //@line 84 "rlwe.c"
  if (!($16)) {
   break;
  }
  $17 = $i; //@line 85 "rlwe.c"
  $18 = $4; //@line 85 "rlwe.c"
  $19 = (($18) + ($17<<2)|0); //@line 85 "rlwe.c"
  $20 = HEAP32[$19>>2]|0; //@line 85 "rlwe.c"
  $21 = (($20>>>0) % 12289)&-1; //@line 85 "rlwe.c"
  $22 = $i; //@line 85 "rlwe.c"
  $23 = $4; //@line 85 "rlwe.c"
  $24 = (($23) + ($22<<2)|0); //@line 85 "rlwe.c"
  HEAP32[$24>>2] = $21; //@line 85 "rlwe.c"
  $25 = $i; //@line 84 "rlwe.c"
  $26 = (($25) + 1)|0; //@line 84 "rlwe.c"
  $i = $26; //@line 84 "rlwe.c"
 }
 $0 = 0; //@line 88 "rlwe.c"
 $27 = $0; //@line 89 "rlwe.c"
 STACKTOP = sp;return ($27|0); //@line 89 "rlwe.c"
}
function _rlwejs_init() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 _randombytes_stir(); //@line 92 "rlwe.c"
 $0 = (_LatticeCrypto_allocate()|0); //@line 94 "rlwe.c"
 HEAP32[2245] = $0; //@line 94 "rlwe.c"
 $1 = HEAP32[2245]|0; //@line 97 "rlwe.c"
 $2 = (_LatticeCrypto_initialize($1,18,18,18)|0); //@line 96 "rlwe.c"
 return ($2|0); //@line 96 "rlwe.c"
}
function _rlwejs_public_key_bytes() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[2057]|0; //@line 105 "rlwe.c"
 $1 = (($0) + 1)|0; //@line 105 "rlwe.c"
 return ($1|0); //@line 105 "rlwe.c"
}
function _rlwejs_private_key_bytes() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[2058]|0; //@line 109 "rlwe.c"
 $1 = (($0) + 1)|0; //@line 109 "rlwe.c"
 $2 = $1<<2; //@line 109 "rlwe.c"
 return ($2|0); //@line 109 "rlwe.c"
}
function _rlwejs_secret_bytes() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 32; //@line 113 "rlwe.c"
}
function _rlwejs_keypair_alice($public_key,$private_key) {
 $public_key = $public_key|0;
 $private_key = $private_key|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $status = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $0 = $public_key;
 $1 = $private_key;
 $2 = $1; //@line 120 "rlwe.c"
 $3 = $0; //@line 120 "rlwe.c"
 $4 = HEAP32[2245]|0; //@line 120 "rlwe.c"
 $5 = (_KeyGeneration_A($2,$3,$4)|0); //@line 120 "rlwe.c"
 $status = $5; //@line 120 "rlwe.c"
 $6 = HEAP32[2057]|0; //@line 122 "rlwe.c"
 $7 = $0; //@line 122 "rlwe.c"
 $8 = (($7) + ($6)|0); //@line 122 "rlwe.c"
 HEAP8[$8>>0] = 1; //@line 122 "rlwe.c"
 $9 = HEAP32[2058]|0; //@line 123 "rlwe.c"
 $10 = $1; //@line 123 "rlwe.c"
 $11 = (($10) + ($9<<2)|0); //@line 123 "rlwe.c"
 HEAP32[$11>>2] = 1; //@line 123 "rlwe.c"
 $12 = $status; //@line 125 "rlwe.c"
 STACKTOP = sp;return ($12|0); //@line 125 "rlwe.c"
}
function _rlwejs_secret_alice($public_key,$private_key,$secret) {
 $public_key = $public_key|0;
 $private_key = $private_key|0;
 $secret = $secret|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $public_key;
 $2 = $private_key;
 $3 = $secret;
 $4 = HEAP32[2057]|0; //@line 133 "rlwe.c"
 $5 = $1; //@line 133 "rlwe.c"
 $6 = (($5) + ($4)|0); //@line 133 "rlwe.c"
 $7 = HEAP8[$6>>0]|0; //@line 133 "rlwe.c"
 $8 = $7&255; //@line 133 "rlwe.c"
 $9 = ($8|0)!=(0); //@line 133 "rlwe.c"
 if (!($9)) {
  $10 = HEAP32[2058]|0; //@line 133 "rlwe.c"
  $11 = $2; //@line 133 "rlwe.c"
  $12 = (($11) + ($10<<2)|0); //@line 133 "rlwe.c"
  $13 = HEAP32[$12>>2]|0; //@line 133 "rlwe.c"
  $14 = ($13|0)!=(0); //@line 133 "rlwe.c"
  if ($14) {
   $15 = $1; //@line 137 "rlwe.c"
   $16 = $2; //@line 137 "rlwe.c"
   $17 = $3; //@line 137 "rlwe.c"
   $18 = (_SecretAgreement_A($15,$16,$17)|0); //@line 137 "rlwe.c"
   $0 = $18; //@line 137 "rlwe.c"
   $19 = $0; //@line 138 "rlwe.c"
   STACKTOP = sp;return ($19|0); //@line 138 "rlwe.c"
  }
 }
 $0 = 6; //@line 134 "rlwe.c"
 $19 = $0; //@line 138 "rlwe.c"
 STACKTOP = sp;return ($19|0); //@line 138 "rlwe.c"
}
function _rlwejs_secret_bob($public_key_alice,$public_key_bob,$secret) {
 $public_key_alice = $public_key_alice|0;
 $public_key_bob = $public_key_bob|0;
 $secret = $secret|0;
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $status = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abort();
 $1 = $public_key_alice;
 $2 = $public_key_bob;
 $3 = $secret;
 $4 = HEAP32[2057]|0; //@line 145 "rlwe.c"
 $5 = $1; //@line 145 "rlwe.c"
 $6 = (($5) + ($4)|0); //@line 145 "rlwe.c"
 $7 = HEAP8[$6>>0]|0; //@line 145 "rlwe.c"
 $8 = ($7<<24>>24)!=(0); //@line 145 "rlwe.c"
 if ($8) {
  $9 = $1; //@line 149 "rlwe.c"
  $10 = $3; //@line 149 "rlwe.c"
  $11 = $2; //@line 149 "rlwe.c"
  $12 = HEAP32[2245]|0; //@line 149 "rlwe.c"
  $13 = (_SecretAgreement_B($9,$10,$11,$12)|0); //@line 149 "rlwe.c"
  $status = $13; //@line 149 "rlwe.c"
  $14 = HEAP32[2057]|0; //@line 151 "rlwe.c"
  $15 = $2; //@line 151 "rlwe.c"
  $16 = (($15) + ($14)|0); //@line 151 "rlwe.c"
  HEAP8[$16>>0] = 0; //@line 151 "rlwe.c"
  $17 = $status; //@line 153 "rlwe.c"
  $0 = $17; //@line 153 "rlwe.c"
  $18 = $0; //@line 154 "rlwe.c"
  STACKTOP = sp;return ($18|0); //@line 154 "rlwe.c"
 } else {
  $0 = 6; //@line 146 "rlwe.c"
  $18 = $0; //@line 154 "rlwe.c"
  STACKTOP = sp;return ($18|0); //@line 154 "rlwe.c"
 }
 return (0)|0;
}
function ___errno_location() {
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[2246]|0;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $$0 = 9028;
 } else {
  $2 = (_pthread_self()|0);
  $3 = ((($2)) + 64|0);
  $4 = HEAP32[$3>>2]|0;
  $$0 = $4;
 }
 return ($$0|0);
}
function _malloc($bytes) {
 $bytes = $bytes|0;
 var $$0 = 0, $$lcssa = 0, $$lcssa141 = 0, $$lcssa142 = 0, $$lcssa144 = 0, $$lcssa147 = 0, $$lcssa149 = 0, $$lcssa151 = 0, $$lcssa153 = 0, $$lcssa155 = 0, $$lcssa157 = 0, $$not$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i13 = 0, $$pre$i16$i = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i14Z2D = 0, $$pre$phi$i17$iZ2D = 0;
 var $$pre$phi$iZ2D = 0, $$pre$phi10$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre71 = 0, $$pre9$i$i = 0, $$rsize$0$i = 0, $$rsize$4$i = 0, $$v$0$i = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0;
 var $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0;
 var $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0;
 var $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0;
 var $1062 = 0, $1063 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0;
 var $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0;
 var $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0;
 var $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0;
 var $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0;
 var $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0;
 var $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0;
 var $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0;
 var $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0;
 var $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0;
 var $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0;
 var $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0;
 var $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0;
 var $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0;
 var $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0;
 var $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0;
 var $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0;
 var $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0;
 var $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0;
 var $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0;
 var $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0;
 var $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0;
 var $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0;
 var $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0;
 var $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0;
 var $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0;
 var $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0;
 var $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0;
 var $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0;
 var $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0;
 var $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0;
 var $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0;
 var $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0;
 var $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0;
 var $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0;
 var $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0;
 var $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0;
 var $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0;
 var $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0;
 var $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0;
 var $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0;
 var $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0;
 var $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0;
 var $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0;
 var $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0;
 var $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0;
 var $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0;
 var $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0;
 var $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0;
 var $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $F$0$i$i = 0, $F1$0$i = 0, $F4$0 = 0, $F4$0$i$i = 0, $F5$0$i = 0, $I1$0$i$i = 0, $I7$0$i = 0, $I7$0$i$i = 0;
 var $K12$0$i = 0, $K2$0$i$i = 0, $K8$0$i$i = 0, $R$1$i = 0, $R$1$i$i = 0, $R$1$i$i$lcssa = 0, $R$1$i$lcssa = 0, $R$1$i9 = 0, $R$1$i9$lcssa = 0, $R$3$i = 0, $R$3$i$i = 0, $R$3$i11 = 0, $RP$1$i = 0, $RP$1$i$i = 0, $RP$1$i$i$lcssa = 0, $RP$1$i$lcssa = 0, $RP$1$i8 = 0, $RP$1$i8$lcssa = 0, $T$0$i = 0, $T$0$i$i = 0;
 var $T$0$i$i$lcssa = 0, $T$0$i$i$lcssa140 = 0, $T$0$i$lcssa = 0, $T$0$i$lcssa156 = 0, $T$0$i18$i = 0, $T$0$i18$i$lcssa = 0, $T$0$i18$i$lcssa139 = 0, $br$2$ph$i = 0, $cond$i = 0, $cond$i$i = 0, $cond$i12 = 0, $exitcond$i$i = 0, $i$01$i$i = 0, $idx$0$i = 0, $nb$0 = 0, $not$$i$i = 0, $not$$i20$i = 0, $not$7$i = 0, $oldfirst$0$i$i = 0, $or$cond$i = 0;
 var $or$cond$i17 = 0, $or$cond1$i = 0, $or$cond1$i16 = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond2$i = 0, $or$cond48$i = 0, $or$cond5$i = 0, $or$cond7$i = 0, $or$cond8$i = 0, $p$0$i$i = 0, $qsize$0$i$i = 0, $rsize$0$i = 0, $rsize$0$i$lcssa = 0, $rsize$0$i5 = 0, $rsize$1$i = 0, $rsize$3$i = 0, $rsize$4$lcssa$i = 0, $rsize$412$i = 0, $rst$0$i = 0;
 var $rst$1$i = 0, $sizebits$0$$i = 0, $sizebits$0$i = 0, $sp$0$i$i = 0, $sp$0$i$i$i = 0, $sp$068$i = 0, $sp$068$i$lcssa = 0, $sp$167$i = 0, $sp$167$i$lcssa = 0, $ssize$0$i = 0, $ssize$2$ph$i = 0, $ssize$5$i = 0, $t$0$i = 0, $t$0$i4 = 0, $t$2$i = 0, $t$4$ph$i = 0, $t$4$v$4$i = 0, $t$411$i = 0, $tbase$746$i = 0, $tsize$745$i = 0;
 var $v$0$i = 0, $v$0$i$lcssa = 0, $v$0$i6 = 0, $v$1$i = 0, $v$3$i = 0, $v$4$lcssa$i = 0, $v$413$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($bytes>>>0)<(245);
 do {
  if ($0) {
   $1 = ($bytes>>>0)<(11);
   $2 = (($bytes) + 11)|0;
   $3 = $2 & -8;
   $4 = $1 ? 16 : $3;
   $5 = $4 >>> 3;
   $6 = HEAP32[2258]|0;
   $7 = $6 >>> $5;
   $8 = $7 & 3;
   $9 = ($8|0)==(0);
   if (!($9)) {
    $10 = $7 & 1;
    $11 = $10 ^ 1;
    $12 = (($11) + ($5))|0;
    $13 = $12 << 1;
    $14 = (9072 + ($13<<2)|0);
    $15 = ((($14)) + 8|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ($14|0)==($18|0);
    do {
     if ($19) {
      $20 = 1 << $12;
      $21 = $20 ^ -1;
      $22 = $6 & $21;
      HEAP32[2258] = $22;
     } else {
      $23 = HEAP32[(9048)>>2]|0;
      $24 = ($18>>>0)<($23>>>0);
      if ($24) {
       _abort();
       // unreachable;
      }
      $25 = ((($18)) + 12|0);
      $26 = HEAP32[$25>>2]|0;
      $27 = ($26|0)==($16|0);
      if ($27) {
       HEAP32[$25>>2] = $14;
       HEAP32[$15>>2] = $18;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $28 = $12 << 3;
    $29 = $28 | 3;
    $30 = ((($16)) + 4|0);
    HEAP32[$30>>2] = $29;
    $31 = (($16) + ($28)|0);
    $32 = ((($31)) + 4|0);
    $33 = HEAP32[$32>>2]|0;
    $34 = $33 | 1;
    HEAP32[$32>>2] = $34;
    $$0 = $17;
    return ($$0|0);
   }
   $35 = HEAP32[(9040)>>2]|0;
   $36 = ($4>>>0)>($35>>>0);
   if ($36) {
    $37 = ($7|0)==(0);
    if (!($37)) {
     $38 = $7 << $5;
     $39 = 2 << $5;
     $40 = (0 - ($39))|0;
     $41 = $39 | $40;
     $42 = $38 & $41;
     $43 = (0 - ($42))|0;
     $44 = $42 & $43;
     $45 = (($44) + -1)|0;
     $46 = $45 >>> 12;
     $47 = $46 & 16;
     $48 = $45 >>> $47;
     $49 = $48 >>> 5;
     $50 = $49 & 8;
     $51 = $50 | $47;
     $52 = $48 >>> $50;
     $53 = $52 >>> 2;
     $54 = $53 & 4;
     $55 = $51 | $54;
     $56 = $52 >>> $54;
     $57 = $56 >>> 1;
     $58 = $57 & 2;
     $59 = $55 | $58;
     $60 = $56 >>> $58;
     $61 = $60 >>> 1;
     $62 = $61 & 1;
     $63 = $59 | $62;
     $64 = $60 >>> $62;
     $65 = (($63) + ($64))|0;
     $66 = $65 << 1;
     $67 = (9072 + ($66<<2)|0);
     $68 = ((($67)) + 8|0);
     $69 = HEAP32[$68>>2]|0;
     $70 = ((($69)) + 8|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = ($67|0)==($71|0);
     do {
      if ($72) {
       $73 = 1 << $65;
       $74 = $73 ^ -1;
       $75 = $6 & $74;
       HEAP32[2258] = $75;
       $89 = $35;
      } else {
       $76 = HEAP32[(9048)>>2]|0;
       $77 = ($71>>>0)<($76>>>0);
       if ($77) {
        _abort();
        // unreachable;
       }
       $78 = ((($71)) + 12|0);
       $79 = HEAP32[$78>>2]|0;
       $80 = ($79|0)==($69|0);
       if ($80) {
        HEAP32[$78>>2] = $67;
        HEAP32[$68>>2] = $71;
        $$pre = HEAP32[(9040)>>2]|0;
        $89 = $$pre;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $81 = $65 << 3;
     $82 = (($81) - ($4))|0;
     $83 = $4 | 3;
     $84 = ((($69)) + 4|0);
     HEAP32[$84>>2] = $83;
     $85 = (($69) + ($4)|0);
     $86 = $82 | 1;
     $87 = ((($85)) + 4|0);
     HEAP32[$87>>2] = $86;
     $88 = (($85) + ($82)|0);
     HEAP32[$88>>2] = $82;
     $90 = ($89|0)==(0);
     if (!($90)) {
      $91 = HEAP32[(9052)>>2]|0;
      $92 = $89 >>> 3;
      $93 = $92 << 1;
      $94 = (9072 + ($93<<2)|0);
      $95 = HEAP32[2258]|0;
      $96 = 1 << $92;
      $97 = $95 & $96;
      $98 = ($97|0)==(0);
      if ($98) {
       $99 = $95 | $96;
       HEAP32[2258] = $99;
       $$pre71 = ((($94)) + 8|0);
       $$pre$phiZ2D = $$pre71;$F4$0 = $94;
      } else {
       $100 = ((($94)) + 8|0);
       $101 = HEAP32[$100>>2]|0;
       $102 = HEAP32[(9048)>>2]|0;
       $103 = ($101>>>0)<($102>>>0);
       if ($103) {
        _abort();
        // unreachable;
       } else {
        $$pre$phiZ2D = $100;$F4$0 = $101;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $91;
      $104 = ((($F4$0)) + 12|0);
      HEAP32[$104>>2] = $91;
      $105 = ((($91)) + 8|0);
      HEAP32[$105>>2] = $F4$0;
      $106 = ((($91)) + 12|0);
      HEAP32[$106>>2] = $94;
     }
     HEAP32[(9040)>>2] = $82;
     HEAP32[(9052)>>2] = $85;
     $$0 = $70;
     return ($$0|0);
    }
    $107 = HEAP32[(9036)>>2]|0;
    $108 = ($107|0)==(0);
    if ($108) {
     $nb$0 = $4;
    } else {
     $109 = (0 - ($107))|0;
     $110 = $107 & $109;
     $111 = (($110) + -1)|0;
     $112 = $111 >>> 12;
     $113 = $112 & 16;
     $114 = $111 >>> $113;
     $115 = $114 >>> 5;
     $116 = $115 & 8;
     $117 = $116 | $113;
     $118 = $114 >>> $116;
     $119 = $118 >>> 2;
     $120 = $119 & 4;
     $121 = $117 | $120;
     $122 = $118 >>> $120;
     $123 = $122 >>> 1;
     $124 = $123 & 2;
     $125 = $121 | $124;
     $126 = $122 >>> $124;
     $127 = $126 >>> 1;
     $128 = $127 & 1;
     $129 = $125 | $128;
     $130 = $126 >>> $128;
     $131 = (($129) + ($130))|0;
     $132 = (9336 + ($131<<2)|0);
     $133 = HEAP32[$132>>2]|0;
     $134 = ((($133)) + 4|0);
     $135 = HEAP32[$134>>2]|0;
     $136 = $135 & -8;
     $137 = (($136) - ($4))|0;
     $rsize$0$i = $137;$t$0$i = $133;$v$0$i = $133;
     while(1) {
      $138 = ((($t$0$i)) + 16|0);
      $139 = HEAP32[$138>>2]|0;
      $140 = ($139|0)==(0|0);
      if ($140) {
       $141 = ((($t$0$i)) + 20|0);
       $142 = HEAP32[$141>>2]|0;
       $143 = ($142|0)==(0|0);
       if ($143) {
        $rsize$0$i$lcssa = $rsize$0$i;$v$0$i$lcssa = $v$0$i;
        break;
       } else {
        $145 = $142;
       }
      } else {
       $145 = $139;
      }
      $144 = ((($145)) + 4|0);
      $146 = HEAP32[$144>>2]|0;
      $147 = $146 & -8;
      $148 = (($147) - ($4))|0;
      $149 = ($148>>>0)<($rsize$0$i>>>0);
      $$rsize$0$i = $149 ? $148 : $rsize$0$i;
      $$v$0$i = $149 ? $145 : $v$0$i;
      $rsize$0$i = $$rsize$0$i;$t$0$i = $145;$v$0$i = $$v$0$i;
     }
     $150 = HEAP32[(9048)>>2]|0;
     $151 = ($v$0$i$lcssa>>>0)<($150>>>0);
     if ($151) {
      _abort();
      // unreachable;
     }
     $152 = (($v$0$i$lcssa) + ($4)|0);
     $153 = ($v$0$i$lcssa>>>0)<($152>>>0);
     if (!($153)) {
      _abort();
      // unreachable;
     }
     $154 = ((($v$0$i$lcssa)) + 24|0);
     $155 = HEAP32[$154>>2]|0;
     $156 = ((($v$0$i$lcssa)) + 12|0);
     $157 = HEAP32[$156>>2]|0;
     $158 = ($157|0)==($v$0$i$lcssa|0);
     do {
      if ($158) {
       $168 = ((($v$0$i$lcssa)) + 20|0);
       $169 = HEAP32[$168>>2]|0;
       $170 = ($169|0)==(0|0);
       if ($170) {
        $171 = ((($v$0$i$lcssa)) + 16|0);
        $172 = HEAP32[$171>>2]|0;
        $173 = ($172|0)==(0|0);
        if ($173) {
         $R$3$i = 0;
         break;
        } else {
         $R$1$i = $172;$RP$1$i = $171;
        }
       } else {
        $R$1$i = $169;$RP$1$i = $168;
       }
       while(1) {
        $174 = ((($R$1$i)) + 20|0);
        $175 = HEAP32[$174>>2]|0;
        $176 = ($175|0)==(0|0);
        if (!($176)) {
         $R$1$i = $175;$RP$1$i = $174;
         continue;
        }
        $177 = ((($R$1$i)) + 16|0);
        $178 = HEAP32[$177>>2]|0;
        $179 = ($178|0)==(0|0);
        if ($179) {
         $R$1$i$lcssa = $R$1$i;$RP$1$i$lcssa = $RP$1$i;
         break;
        } else {
         $R$1$i = $178;$RP$1$i = $177;
        }
       }
       $180 = ($RP$1$i$lcssa>>>0)<($150>>>0);
       if ($180) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$RP$1$i$lcssa>>2] = 0;
        $R$3$i = $R$1$i$lcssa;
        break;
       }
      } else {
       $159 = ((($v$0$i$lcssa)) + 8|0);
       $160 = HEAP32[$159>>2]|0;
       $161 = ($160>>>0)<($150>>>0);
       if ($161) {
        _abort();
        // unreachable;
       }
       $162 = ((($160)) + 12|0);
       $163 = HEAP32[$162>>2]|0;
       $164 = ($163|0)==($v$0$i$lcssa|0);
       if (!($164)) {
        _abort();
        // unreachable;
       }
       $165 = ((($157)) + 8|0);
       $166 = HEAP32[$165>>2]|0;
       $167 = ($166|0)==($v$0$i$lcssa|0);
       if ($167) {
        HEAP32[$162>>2] = $157;
        HEAP32[$165>>2] = $160;
        $R$3$i = $157;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $181 = ($155|0)==(0|0);
     do {
      if (!($181)) {
       $182 = ((($v$0$i$lcssa)) + 28|0);
       $183 = HEAP32[$182>>2]|0;
       $184 = (9336 + ($183<<2)|0);
       $185 = HEAP32[$184>>2]|0;
       $186 = ($v$0$i$lcssa|0)==($185|0);
       if ($186) {
        HEAP32[$184>>2] = $R$3$i;
        $cond$i = ($R$3$i|0)==(0|0);
        if ($cond$i) {
         $187 = 1 << $183;
         $188 = $187 ^ -1;
         $189 = HEAP32[(9036)>>2]|0;
         $190 = $189 & $188;
         HEAP32[(9036)>>2] = $190;
         break;
        }
       } else {
        $191 = HEAP32[(9048)>>2]|0;
        $192 = ($155>>>0)<($191>>>0);
        if ($192) {
         _abort();
         // unreachable;
        }
        $193 = ((($155)) + 16|0);
        $194 = HEAP32[$193>>2]|0;
        $195 = ($194|0)==($v$0$i$lcssa|0);
        if ($195) {
         HEAP32[$193>>2] = $R$3$i;
        } else {
         $196 = ((($155)) + 20|0);
         HEAP32[$196>>2] = $R$3$i;
        }
        $197 = ($R$3$i|0)==(0|0);
        if ($197) {
         break;
        }
       }
       $198 = HEAP32[(9048)>>2]|0;
       $199 = ($R$3$i>>>0)<($198>>>0);
       if ($199) {
        _abort();
        // unreachable;
       }
       $200 = ((($R$3$i)) + 24|0);
       HEAP32[$200>>2] = $155;
       $201 = ((($v$0$i$lcssa)) + 16|0);
       $202 = HEAP32[$201>>2]|0;
       $203 = ($202|0)==(0|0);
       do {
        if (!($203)) {
         $204 = ($202>>>0)<($198>>>0);
         if ($204) {
          _abort();
          // unreachable;
         } else {
          $205 = ((($R$3$i)) + 16|0);
          HEAP32[$205>>2] = $202;
          $206 = ((($202)) + 24|0);
          HEAP32[$206>>2] = $R$3$i;
          break;
         }
        }
       } while(0);
       $207 = ((($v$0$i$lcssa)) + 20|0);
       $208 = HEAP32[$207>>2]|0;
       $209 = ($208|0)==(0|0);
       if (!($209)) {
        $210 = HEAP32[(9048)>>2]|0;
        $211 = ($208>>>0)<($210>>>0);
        if ($211) {
         _abort();
         // unreachable;
        } else {
         $212 = ((($R$3$i)) + 20|0);
         HEAP32[$212>>2] = $208;
         $213 = ((($208)) + 24|0);
         HEAP32[$213>>2] = $R$3$i;
         break;
        }
       }
      }
     } while(0);
     $214 = ($rsize$0$i$lcssa>>>0)<(16);
     if ($214) {
      $215 = (($rsize$0$i$lcssa) + ($4))|0;
      $216 = $215 | 3;
      $217 = ((($v$0$i$lcssa)) + 4|0);
      HEAP32[$217>>2] = $216;
      $218 = (($v$0$i$lcssa) + ($215)|0);
      $219 = ((($218)) + 4|0);
      $220 = HEAP32[$219>>2]|0;
      $221 = $220 | 1;
      HEAP32[$219>>2] = $221;
     } else {
      $222 = $4 | 3;
      $223 = ((($v$0$i$lcssa)) + 4|0);
      HEAP32[$223>>2] = $222;
      $224 = $rsize$0$i$lcssa | 1;
      $225 = ((($152)) + 4|0);
      HEAP32[$225>>2] = $224;
      $226 = (($152) + ($rsize$0$i$lcssa)|0);
      HEAP32[$226>>2] = $rsize$0$i$lcssa;
      $227 = HEAP32[(9040)>>2]|0;
      $228 = ($227|0)==(0);
      if (!($228)) {
       $229 = HEAP32[(9052)>>2]|0;
       $230 = $227 >>> 3;
       $231 = $230 << 1;
       $232 = (9072 + ($231<<2)|0);
       $233 = HEAP32[2258]|0;
       $234 = 1 << $230;
       $235 = $233 & $234;
       $236 = ($235|0)==(0);
       if ($236) {
        $237 = $233 | $234;
        HEAP32[2258] = $237;
        $$pre$i = ((($232)) + 8|0);
        $$pre$phi$iZ2D = $$pre$i;$F1$0$i = $232;
       } else {
        $238 = ((($232)) + 8|0);
        $239 = HEAP32[$238>>2]|0;
        $240 = HEAP32[(9048)>>2]|0;
        $241 = ($239>>>0)<($240>>>0);
        if ($241) {
         _abort();
         // unreachable;
        } else {
         $$pre$phi$iZ2D = $238;$F1$0$i = $239;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $229;
       $242 = ((($F1$0$i)) + 12|0);
       HEAP32[$242>>2] = $229;
       $243 = ((($229)) + 8|0);
       HEAP32[$243>>2] = $F1$0$i;
       $244 = ((($229)) + 12|0);
       HEAP32[$244>>2] = $232;
      }
      HEAP32[(9040)>>2] = $rsize$0$i$lcssa;
      HEAP32[(9052)>>2] = $152;
     }
     $245 = ((($v$0$i$lcssa)) + 8|0);
     $$0 = $245;
     return ($$0|0);
    }
   } else {
    $nb$0 = $4;
   }
  } else {
   $246 = ($bytes>>>0)>(4294967231);
   if ($246) {
    $nb$0 = -1;
   } else {
    $247 = (($bytes) + 11)|0;
    $248 = $247 & -8;
    $249 = HEAP32[(9036)>>2]|0;
    $250 = ($249|0)==(0);
    if ($250) {
     $nb$0 = $248;
    } else {
     $251 = (0 - ($248))|0;
     $252 = $247 >>> 8;
     $253 = ($252|0)==(0);
     if ($253) {
      $idx$0$i = 0;
     } else {
      $254 = ($248>>>0)>(16777215);
      if ($254) {
       $idx$0$i = 31;
      } else {
       $255 = (($252) + 1048320)|0;
       $256 = $255 >>> 16;
       $257 = $256 & 8;
       $258 = $252 << $257;
       $259 = (($258) + 520192)|0;
       $260 = $259 >>> 16;
       $261 = $260 & 4;
       $262 = $261 | $257;
       $263 = $258 << $261;
       $264 = (($263) + 245760)|0;
       $265 = $264 >>> 16;
       $266 = $265 & 2;
       $267 = $262 | $266;
       $268 = (14 - ($267))|0;
       $269 = $263 << $266;
       $270 = $269 >>> 15;
       $271 = (($268) + ($270))|0;
       $272 = $271 << 1;
       $273 = (($271) + 7)|0;
       $274 = $248 >>> $273;
       $275 = $274 & 1;
       $276 = $275 | $272;
       $idx$0$i = $276;
      }
     }
     $277 = (9336 + ($idx$0$i<<2)|0);
     $278 = HEAP32[$277>>2]|0;
     $279 = ($278|0)==(0|0);
     L123: do {
      if ($279) {
       $rsize$3$i = $251;$t$2$i = 0;$v$3$i = 0;
       label = 86;
      } else {
       $280 = ($idx$0$i|0)==(31);
       $281 = $idx$0$i >>> 1;
       $282 = (25 - ($281))|0;
       $283 = $280 ? 0 : $282;
       $284 = $248 << $283;
       $rsize$0$i5 = $251;$rst$0$i = 0;$sizebits$0$i = $284;$t$0$i4 = $278;$v$0$i6 = 0;
       while(1) {
        $285 = ((($t$0$i4)) + 4|0);
        $286 = HEAP32[$285>>2]|0;
        $287 = $286 & -8;
        $288 = (($287) - ($248))|0;
        $289 = ($288>>>0)<($rsize$0$i5>>>0);
        if ($289) {
         $290 = ($287|0)==($248|0);
         if ($290) {
          $rsize$412$i = $288;$t$411$i = $t$0$i4;$v$413$i = $t$0$i4;
          label = 90;
          break L123;
         } else {
          $rsize$1$i = $288;$v$1$i = $t$0$i4;
         }
        } else {
         $rsize$1$i = $rsize$0$i5;$v$1$i = $v$0$i6;
        }
        $291 = ((($t$0$i4)) + 20|0);
        $292 = HEAP32[$291>>2]|0;
        $293 = $sizebits$0$i >>> 31;
        $294 = (((($t$0$i4)) + 16|0) + ($293<<2)|0);
        $295 = HEAP32[$294>>2]|0;
        $296 = ($292|0)==(0|0);
        $297 = ($292|0)==($295|0);
        $or$cond1$i = $296 | $297;
        $rst$1$i = $or$cond1$i ? $rst$0$i : $292;
        $298 = ($295|0)==(0|0);
        $299 = $298&1;
        $300 = $299 ^ 1;
        $sizebits$0$$i = $sizebits$0$i << $300;
        if ($298) {
         $rsize$3$i = $rsize$1$i;$t$2$i = $rst$1$i;$v$3$i = $v$1$i;
         label = 86;
         break;
        } else {
         $rsize$0$i5 = $rsize$1$i;$rst$0$i = $rst$1$i;$sizebits$0$i = $sizebits$0$$i;$t$0$i4 = $295;$v$0$i6 = $v$1$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 86) {
      $301 = ($t$2$i|0)==(0|0);
      $302 = ($v$3$i|0)==(0|0);
      $or$cond$i = $301 & $302;
      if ($or$cond$i) {
       $303 = 2 << $idx$0$i;
       $304 = (0 - ($303))|0;
       $305 = $303 | $304;
       $306 = $249 & $305;
       $307 = ($306|0)==(0);
       if ($307) {
        $nb$0 = $248;
        break;
       }
       $308 = (0 - ($306))|0;
       $309 = $306 & $308;
       $310 = (($309) + -1)|0;
       $311 = $310 >>> 12;
       $312 = $311 & 16;
       $313 = $310 >>> $312;
       $314 = $313 >>> 5;
       $315 = $314 & 8;
       $316 = $315 | $312;
       $317 = $313 >>> $315;
       $318 = $317 >>> 2;
       $319 = $318 & 4;
       $320 = $316 | $319;
       $321 = $317 >>> $319;
       $322 = $321 >>> 1;
       $323 = $322 & 2;
       $324 = $320 | $323;
       $325 = $321 >>> $323;
       $326 = $325 >>> 1;
       $327 = $326 & 1;
       $328 = $324 | $327;
       $329 = $325 >>> $327;
       $330 = (($328) + ($329))|0;
       $331 = (9336 + ($330<<2)|0);
       $332 = HEAP32[$331>>2]|0;
       $t$4$ph$i = $332;
      } else {
       $t$4$ph$i = $t$2$i;
      }
      $333 = ($t$4$ph$i|0)==(0|0);
      if ($333) {
       $rsize$4$lcssa$i = $rsize$3$i;$v$4$lcssa$i = $v$3$i;
      } else {
       $rsize$412$i = $rsize$3$i;$t$411$i = $t$4$ph$i;$v$413$i = $v$3$i;
       label = 90;
      }
     }
     if ((label|0) == 90) {
      while(1) {
       label = 0;
       $334 = ((($t$411$i)) + 4|0);
       $335 = HEAP32[$334>>2]|0;
       $336 = $335 & -8;
       $337 = (($336) - ($248))|0;
       $338 = ($337>>>0)<($rsize$412$i>>>0);
       $$rsize$4$i = $338 ? $337 : $rsize$412$i;
       $t$4$v$4$i = $338 ? $t$411$i : $v$413$i;
       $339 = ((($t$411$i)) + 16|0);
       $340 = HEAP32[$339>>2]|0;
       $341 = ($340|0)==(0|0);
       if (!($341)) {
        $rsize$412$i = $$rsize$4$i;$t$411$i = $340;$v$413$i = $t$4$v$4$i;
        label = 90;
        continue;
       }
       $342 = ((($t$411$i)) + 20|0);
       $343 = HEAP32[$342>>2]|0;
       $344 = ($343|0)==(0|0);
       if ($344) {
        $rsize$4$lcssa$i = $$rsize$4$i;$v$4$lcssa$i = $t$4$v$4$i;
        break;
       } else {
        $rsize$412$i = $$rsize$4$i;$t$411$i = $343;$v$413$i = $t$4$v$4$i;
        label = 90;
       }
      }
     }
     $345 = ($v$4$lcssa$i|0)==(0|0);
     if ($345) {
      $nb$0 = $248;
     } else {
      $346 = HEAP32[(9040)>>2]|0;
      $347 = (($346) - ($248))|0;
      $348 = ($rsize$4$lcssa$i>>>0)<($347>>>0);
      if ($348) {
       $349 = HEAP32[(9048)>>2]|0;
       $350 = ($v$4$lcssa$i>>>0)<($349>>>0);
       if ($350) {
        _abort();
        // unreachable;
       }
       $351 = (($v$4$lcssa$i) + ($248)|0);
       $352 = ($v$4$lcssa$i>>>0)<($351>>>0);
       if (!($352)) {
        _abort();
        // unreachable;
       }
       $353 = ((($v$4$lcssa$i)) + 24|0);
       $354 = HEAP32[$353>>2]|0;
       $355 = ((($v$4$lcssa$i)) + 12|0);
       $356 = HEAP32[$355>>2]|0;
       $357 = ($356|0)==($v$4$lcssa$i|0);
       do {
        if ($357) {
         $367 = ((($v$4$lcssa$i)) + 20|0);
         $368 = HEAP32[$367>>2]|0;
         $369 = ($368|0)==(0|0);
         if ($369) {
          $370 = ((($v$4$lcssa$i)) + 16|0);
          $371 = HEAP32[$370>>2]|0;
          $372 = ($371|0)==(0|0);
          if ($372) {
           $R$3$i11 = 0;
           break;
          } else {
           $R$1$i9 = $371;$RP$1$i8 = $370;
          }
         } else {
          $R$1$i9 = $368;$RP$1$i8 = $367;
         }
         while(1) {
          $373 = ((($R$1$i9)) + 20|0);
          $374 = HEAP32[$373>>2]|0;
          $375 = ($374|0)==(0|0);
          if (!($375)) {
           $R$1$i9 = $374;$RP$1$i8 = $373;
           continue;
          }
          $376 = ((($R$1$i9)) + 16|0);
          $377 = HEAP32[$376>>2]|0;
          $378 = ($377|0)==(0|0);
          if ($378) {
           $R$1$i9$lcssa = $R$1$i9;$RP$1$i8$lcssa = $RP$1$i8;
           break;
          } else {
           $R$1$i9 = $377;$RP$1$i8 = $376;
          }
         }
         $379 = ($RP$1$i8$lcssa>>>0)<($349>>>0);
         if ($379) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$RP$1$i8$lcssa>>2] = 0;
          $R$3$i11 = $R$1$i9$lcssa;
          break;
         }
        } else {
         $358 = ((($v$4$lcssa$i)) + 8|0);
         $359 = HEAP32[$358>>2]|0;
         $360 = ($359>>>0)<($349>>>0);
         if ($360) {
          _abort();
          // unreachable;
         }
         $361 = ((($359)) + 12|0);
         $362 = HEAP32[$361>>2]|0;
         $363 = ($362|0)==($v$4$lcssa$i|0);
         if (!($363)) {
          _abort();
          // unreachable;
         }
         $364 = ((($356)) + 8|0);
         $365 = HEAP32[$364>>2]|0;
         $366 = ($365|0)==($v$4$lcssa$i|0);
         if ($366) {
          HEAP32[$361>>2] = $356;
          HEAP32[$364>>2] = $359;
          $R$3$i11 = $356;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $380 = ($354|0)==(0|0);
       do {
        if (!($380)) {
         $381 = ((($v$4$lcssa$i)) + 28|0);
         $382 = HEAP32[$381>>2]|0;
         $383 = (9336 + ($382<<2)|0);
         $384 = HEAP32[$383>>2]|0;
         $385 = ($v$4$lcssa$i|0)==($384|0);
         if ($385) {
          HEAP32[$383>>2] = $R$3$i11;
          $cond$i12 = ($R$3$i11|0)==(0|0);
          if ($cond$i12) {
           $386 = 1 << $382;
           $387 = $386 ^ -1;
           $388 = HEAP32[(9036)>>2]|0;
           $389 = $388 & $387;
           HEAP32[(9036)>>2] = $389;
           break;
          }
         } else {
          $390 = HEAP32[(9048)>>2]|0;
          $391 = ($354>>>0)<($390>>>0);
          if ($391) {
           _abort();
           // unreachable;
          }
          $392 = ((($354)) + 16|0);
          $393 = HEAP32[$392>>2]|0;
          $394 = ($393|0)==($v$4$lcssa$i|0);
          if ($394) {
           HEAP32[$392>>2] = $R$3$i11;
          } else {
           $395 = ((($354)) + 20|0);
           HEAP32[$395>>2] = $R$3$i11;
          }
          $396 = ($R$3$i11|0)==(0|0);
          if ($396) {
           break;
          }
         }
         $397 = HEAP32[(9048)>>2]|0;
         $398 = ($R$3$i11>>>0)<($397>>>0);
         if ($398) {
          _abort();
          // unreachable;
         }
         $399 = ((($R$3$i11)) + 24|0);
         HEAP32[$399>>2] = $354;
         $400 = ((($v$4$lcssa$i)) + 16|0);
         $401 = HEAP32[$400>>2]|0;
         $402 = ($401|0)==(0|0);
         do {
          if (!($402)) {
           $403 = ($401>>>0)<($397>>>0);
           if ($403) {
            _abort();
            // unreachable;
           } else {
            $404 = ((($R$3$i11)) + 16|0);
            HEAP32[$404>>2] = $401;
            $405 = ((($401)) + 24|0);
            HEAP32[$405>>2] = $R$3$i11;
            break;
           }
          }
         } while(0);
         $406 = ((($v$4$lcssa$i)) + 20|0);
         $407 = HEAP32[$406>>2]|0;
         $408 = ($407|0)==(0|0);
         if (!($408)) {
          $409 = HEAP32[(9048)>>2]|0;
          $410 = ($407>>>0)<($409>>>0);
          if ($410) {
           _abort();
           // unreachable;
          } else {
           $411 = ((($R$3$i11)) + 20|0);
           HEAP32[$411>>2] = $407;
           $412 = ((($407)) + 24|0);
           HEAP32[$412>>2] = $R$3$i11;
           break;
          }
         }
        }
       } while(0);
       $413 = ($rsize$4$lcssa$i>>>0)<(16);
       do {
        if ($413) {
         $414 = (($rsize$4$lcssa$i) + ($248))|0;
         $415 = $414 | 3;
         $416 = ((($v$4$lcssa$i)) + 4|0);
         HEAP32[$416>>2] = $415;
         $417 = (($v$4$lcssa$i) + ($414)|0);
         $418 = ((($417)) + 4|0);
         $419 = HEAP32[$418>>2]|0;
         $420 = $419 | 1;
         HEAP32[$418>>2] = $420;
        } else {
         $421 = $248 | 3;
         $422 = ((($v$4$lcssa$i)) + 4|0);
         HEAP32[$422>>2] = $421;
         $423 = $rsize$4$lcssa$i | 1;
         $424 = ((($351)) + 4|0);
         HEAP32[$424>>2] = $423;
         $425 = (($351) + ($rsize$4$lcssa$i)|0);
         HEAP32[$425>>2] = $rsize$4$lcssa$i;
         $426 = $rsize$4$lcssa$i >>> 3;
         $427 = ($rsize$4$lcssa$i>>>0)<(256);
         if ($427) {
          $428 = $426 << 1;
          $429 = (9072 + ($428<<2)|0);
          $430 = HEAP32[2258]|0;
          $431 = 1 << $426;
          $432 = $430 & $431;
          $433 = ($432|0)==(0);
          if ($433) {
           $434 = $430 | $431;
           HEAP32[2258] = $434;
           $$pre$i13 = ((($429)) + 8|0);
           $$pre$phi$i14Z2D = $$pre$i13;$F5$0$i = $429;
          } else {
           $435 = ((($429)) + 8|0);
           $436 = HEAP32[$435>>2]|0;
           $437 = HEAP32[(9048)>>2]|0;
           $438 = ($436>>>0)<($437>>>0);
           if ($438) {
            _abort();
            // unreachable;
           } else {
            $$pre$phi$i14Z2D = $435;$F5$0$i = $436;
           }
          }
          HEAP32[$$pre$phi$i14Z2D>>2] = $351;
          $439 = ((($F5$0$i)) + 12|0);
          HEAP32[$439>>2] = $351;
          $440 = ((($351)) + 8|0);
          HEAP32[$440>>2] = $F5$0$i;
          $441 = ((($351)) + 12|0);
          HEAP32[$441>>2] = $429;
          break;
         }
         $442 = $rsize$4$lcssa$i >>> 8;
         $443 = ($442|0)==(0);
         if ($443) {
          $I7$0$i = 0;
         } else {
          $444 = ($rsize$4$lcssa$i>>>0)>(16777215);
          if ($444) {
           $I7$0$i = 31;
          } else {
           $445 = (($442) + 1048320)|0;
           $446 = $445 >>> 16;
           $447 = $446 & 8;
           $448 = $442 << $447;
           $449 = (($448) + 520192)|0;
           $450 = $449 >>> 16;
           $451 = $450 & 4;
           $452 = $451 | $447;
           $453 = $448 << $451;
           $454 = (($453) + 245760)|0;
           $455 = $454 >>> 16;
           $456 = $455 & 2;
           $457 = $452 | $456;
           $458 = (14 - ($457))|0;
           $459 = $453 << $456;
           $460 = $459 >>> 15;
           $461 = (($458) + ($460))|0;
           $462 = $461 << 1;
           $463 = (($461) + 7)|0;
           $464 = $rsize$4$lcssa$i >>> $463;
           $465 = $464 & 1;
           $466 = $465 | $462;
           $I7$0$i = $466;
          }
         }
         $467 = (9336 + ($I7$0$i<<2)|0);
         $468 = ((($351)) + 28|0);
         HEAP32[$468>>2] = $I7$0$i;
         $469 = ((($351)) + 16|0);
         $470 = ((($469)) + 4|0);
         HEAP32[$470>>2] = 0;
         HEAP32[$469>>2] = 0;
         $471 = HEAP32[(9036)>>2]|0;
         $472 = 1 << $I7$0$i;
         $473 = $471 & $472;
         $474 = ($473|0)==(0);
         if ($474) {
          $475 = $471 | $472;
          HEAP32[(9036)>>2] = $475;
          HEAP32[$467>>2] = $351;
          $476 = ((($351)) + 24|0);
          HEAP32[$476>>2] = $467;
          $477 = ((($351)) + 12|0);
          HEAP32[$477>>2] = $351;
          $478 = ((($351)) + 8|0);
          HEAP32[$478>>2] = $351;
          break;
         }
         $479 = HEAP32[$467>>2]|0;
         $480 = ($I7$0$i|0)==(31);
         $481 = $I7$0$i >>> 1;
         $482 = (25 - ($481))|0;
         $483 = $480 ? 0 : $482;
         $484 = $rsize$4$lcssa$i << $483;
         $K12$0$i = $484;$T$0$i = $479;
         while(1) {
          $485 = ((($T$0$i)) + 4|0);
          $486 = HEAP32[$485>>2]|0;
          $487 = $486 & -8;
          $488 = ($487|0)==($rsize$4$lcssa$i|0);
          if ($488) {
           $T$0$i$lcssa = $T$0$i;
           label = 148;
           break;
          }
          $489 = $K12$0$i >>> 31;
          $490 = (((($T$0$i)) + 16|0) + ($489<<2)|0);
          $491 = $K12$0$i << 1;
          $492 = HEAP32[$490>>2]|0;
          $493 = ($492|0)==(0|0);
          if ($493) {
           $$lcssa157 = $490;$T$0$i$lcssa156 = $T$0$i;
           label = 145;
           break;
          } else {
           $K12$0$i = $491;$T$0$i = $492;
          }
         }
         if ((label|0) == 145) {
          $494 = HEAP32[(9048)>>2]|0;
          $495 = ($$lcssa157>>>0)<($494>>>0);
          if ($495) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$$lcssa157>>2] = $351;
           $496 = ((($351)) + 24|0);
           HEAP32[$496>>2] = $T$0$i$lcssa156;
           $497 = ((($351)) + 12|0);
           HEAP32[$497>>2] = $351;
           $498 = ((($351)) + 8|0);
           HEAP32[$498>>2] = $351;
           break;
          }
         }
         else if ((label|0) == 148) {
          $499 = ((($T$0$i$lcssa)) + 8|0);
          $500 = HEAP32[$499>>2]|0;
          $501 = HEAP32[(9048)>>2]|0;
          $502 = ($500>>>0)>=($501>>>0);
          $not$7$i = ($T$0$i$lcssa>>>0)>=($501>>>0);
          $503 = $502 & $not$7$i;
          if ($503) {
           $504 = ((($500)) + 12|0);
           HEAP32[$504>>2] = $351;
           HEAP32[$499>>2] = $351;
           $505 = ((($351)) + 8|0);
           HEAP32[$505>>2] = $500;
           $506 = ((($351)) + 12|0);
           HEAP32[$506>>2] = $T$0$i$lcssa;
           $507 = ((($351)) + 24|0);
           HEAP32[$507>>2] = 0;
           break;
          } else {
           _abort();
           // unreachable;
          }
         }
        }
       } while(0);
       $508 = ((($v$4$lcssa$i)) + 8|0);
       $$0 = $508;
       return ($$0|0);
      } else {
       $nb$0 = $248;
      }
     }
    }
   }
  }
 } while(0);
 $509 = HEAP32[(9040)>>2]|0;
 $510 = ($509>>>0)<($nb$0>>>0);
 if (!($510)) {
  $511 = (($509) - ($nb$0))|0;
  $512 = HEAP32[(9052)>>2]|0;
  $513 = ($511>>>0)>(15);
  if ($513) {
   $514 = (($512) + ($nb$0)|0);
   HEAP32[(9052)>>2] = $514;
   HEAP32[(9040)>>2] = $511;
   $515 = $511 | 1;
   $516 = ((($514)) + 4|0);
   HEAP32[$516>>2] = $515;
   $517 = (($514) + ($511)|0);
   HEAP32[$517>>2] = $511;
   $518 = $nb$0 | 3;
   $519 = ((($512)) + 4|0);
   HEAP32[$519>>2] = $518;
  } else {
   HEAP32[(9040)>>2] = 0;
   HEAP32[(9052)>>2] = 0;
   $520 = $509 | 3;
   $521 = ((($512)) + 4|0);
   HEAP32[$521>>2] = $520;
   $522 = (($512) + ($509)|0);
   $523 = ((($522)) + 4|0);
   $524 = HEAP32[$523>>2]|0;
   $525 = $524 | 1;
   HEAP32[$523>>2] = $525;
  }
  $526 = ((($512)) + 8|0);
  $$0 = $526;
  return ($$0|0);
 }
 $527 = HEAP32[(9044)>>2]|0;
 $528 = ($527>>>0)>($nb$0>>>0);
 if ($528) {
  $529 = (($527) - ($nb$0))|0;
  HEAP32[(9044)>>2] = $529;
  $530 = HEAP32[(9056)>>2]|0;
  $531 = (($530) + ($nb$0)|0);
  HEAP32[(9056)>>2] = $531;
  $532 = $529 | 1;
  $533 = ((($531)) + 4|0);
  HEAP32[$533>>2] = $532;
  $534 = $nb$0 | 3;
  $535 = ((($530)) + 4|0);
  HEAP32[$535>>2] = $534;
  $536 = ((($530)) + 8|0);
  $$0 = $536;
  return ($$0|0);
 }
 $537 = HEAP32[2376]|0;
 $538 = ($537|0)==(0);
 do {
  if ($538) {
   $539 = (_sysconf(30)|0);
   $540 = (($539) + -1)|0;
   $541 = $540 & $539;
   $542 = ($541|0)==(0);
   if ($542) {
    HEAP32[(9512)>>2] = $539;
    HEAP32[(9508)>>2] = $539;
    HEAP32[(9516)>>2] = -1;
    HEAP32[(9520)>>2] = -1;
    HEAP32[(9524)>>2] = 0;
    HEAP32[(9476)>>2] = 0;
    $543 = (_time((0|0))|0);
    $544 = $543 & -16;
    $545 = $544 ^ 1431655768;
    HEAP32[2376] = $545;
    break;
   } else {
    _abort();
    // unreachable;
   }
  }
 } while(0);
 $546 = (($nb$0) + 48)|0;
 $547 = HEAP32[(9512)>>2]|0;
 $548 = (($nb$0) + 47)|0;
 $549 = (($547) + ($548))|0;
 $550 = (0 - ($547))|0;
 $551 = $549 & $550;
 $552 = ($551>>>0)>($nb$0>>>0);
 if (!($552)) {
  $$0 = 0;
  return ($$0|0);
 }
 $553 = HEAP32[(9472)>>2]|0;
 $554 = ($553|0)==(0);
 if (!($554)) {
  $555 = HEAP32[(9464)>>2]|0;
  $556 = (($555) + ($551))|0;
  $557 = ($556>>>0)<=($555>>>0);
  $558 = ($556>>>0)>($553>>>0);
  $or$cond1$i16 = $557 | $558;
  if ($or$cond1$i16) {
   $$0 = 0;
   return ($$0|0);
  }
 }
 $559 = HEAP32[(9476)>>2]|0;
 $560 = $559 & 4;
 $561 = ($560|0)==(0);
 L257: do {
  if ($561) {
   $562 = HEAP32[(9056)>>2]|0;
   $563 = ($562|0)==(0|0);
   L259: do {
    if ($563) {
     label = 173;
    } else {
     $sp$0$i$i = (9480);
     while(1) {
      $564 = HEAP32[$sp$0$i$i>>2]|0;
      $565 = ($564>>>0)>($562>>>0);
      if (!($565)) {
       $566 = ((($sp$0$i$i)) + 4|0);
       $567 = HEAP32[$566>>2]|0;
       $568 = (($564) + ($567)|0);
       $569 = ($568>>>0)>($562>>>0);
       if ($569) {
        $$lcssa153 = $sp$0$i$i;$$lcssa155 = $566;
        break;
       }
      }
      $570 = ((($sp$0$i$i)) + 8|0);
      $571 = HEAP32[$570>>2]|0;
      $572 = ($571|0)==(0|0);
      if ($572) {
       label = 173;
       break L259;
      } else {
       $sp$0$i$i = $571;
      }
     }
     $595 = HEAP32[(9044)>>2]|0;
     $596 = (($549) - ($595))|0;
     $597 = $596 & $550;
     $598 = ($597>>>0)<(2147483647);
     if ($598) {
      $599 = (_sbrk(($597|0))|0);
      $600 = HEAP32[$$lcssa153>>2]|0;
      $601 = HEAP32[$$lcssa155>>2]|0;
      $602 = (($600) + ($601)|0);
      $603 = ($599|0)==($602|0);
      if ($603) {
       $604 = ($599|0)==((-1)|0);
       if (!($604)) {
        $tbase$746$i = $599;$tsize$745$i = $597;
        label = 193;
        break L257;
       }
      } else {
       $br$2$ph$i = $599;$ssize$2$ph$i = $597;
       label = 183;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 173) {
     $573 = (_sbrk(0)|0);
     $574 = ($573|0)==((-1)|0);
     if (!($574)) {
      $575 = $573;
      $576 = HEAP32[(9508)>>2]|0;
      $577 = (($576) + -1)|0;
      $578 = $577 & $575;
      $579 = ($578|0)==(0);
      if ($579) {
       $ssize$0$i = $551;
      } else {
       $580 = (($577) + ($575))|0;
       $581 = (0 - ($576))|0;
       $582 = $580 & $581;
       $583 = (($551) - ($575))|0;
       $584 = (($583) + ($582))|0;
       $ssize$0$i = $584;
      }
      $585 = HEAP32[(9464)>>2]|0;
      $586 = (($585) + ($ssize$0$i))|0;
      $587 = ($ssize$0$i>>>0)>($nb$0>>>0);
      $588 = ($ssize$0$i>>>0)<(2147483647);
      $or$cond$i17 = $587 & $588;
      if ($or$cond$i17) {
       $589 = HEAP32[(9472)>>2]|0;
       $590 = ($589|0)==(0);
       if (!($590)) {
        $591 = ($586>>>0)<=($585>>>0);
        $592 = ($586>>>0)>($589>>>0);
        $or$cond2$i = $591 | $592;
        if ($or$cond2$i) {
         break;
        }
       }
       $593 = (_sbrk(($ssize$0$i|0))|0);
       $594 = ($593|0)==($573|0);
       if ($594) {
        $tbase$746$i = $573;$tsize$745$i = $ssize$0$i;
        label = 193;
        break L257;
       } else {
        $br$2$ph$i = $593;$ssize$2$ph$i = $ssize$0$i;
        label = 183;
       }
      }
     }
    }
   } while(0);
   L279: do {
    if ((label|0) == 183) {
     $605 = (0 - ($ssize$2$ph$i))|0;
     $606 = ($br$2$ph$i|0)!=((-1)|0);
     $607 = ($ssize$2$ph$i>>>0)<(2147483647);
     $or$cond7$i = $607 & $606;
     $608 = ($546>>>0)>($ssize$2$ph$i>>>0);
     $or$cond8$i = $608 & $or$cond7$i;
     do {
      if ($or$cond8$i) {
       $609 = HEAP32[(9512)>>2]|0;
       $610 = (($548) - ($ssize$2$ph$i))|0;
       $611 = (($610) + ($609))|0;
       $612 = (0 - ($609))|0;
       $613 = $611 & $612;
       $614 = ($613>>>0)<(2147483647);
       if ($614) {
        $615 = (_sbrk(($613|0))|0);
        $616 = ($615|0)==((-1)|0);
        if ($616) {
         (_sbrk(($605|0))|0);
         break L279;
        } else {
         $617 = (($613) + ($ssize$2$ph$i))|0;
         $ssize$5$i = $617;
         break;
        }
       } else {
        $ssize$5$i = $ssize$2$ph$i;
       }
      } else {
       $ssize$5$i = $ssize$2$ph$i;
      }
     } while(0);
     $618 = ($br$2$ph$i|0)==((-1)|0);
     if (!($618)) {
      $tbase$746$i = $br$2$ph$i;$tsize$745$i = $ssize$5$i;
      label = 193;
      break L257;
     }
    }
   } while(0);
   $619 = HEAP32[(9476)>>2]|0;
   $620 = $619 | 4;
   HEAP32[(9476)>>2] = $620;
   label = 190;
  } else {
   label = 190;
  }
 } while(0);
 if ((label|0) == 190) {
  $621 = ($551>>>0)<(2147483647);
  if ($621) {
   $622 = (_sbrk(($551|0))|0);
   $623 = (_sbrk(0)|0);
   $624 = ($622|0)!=((-1)|0);
   $625 = ($623|0)!=((-1)|0);
   $or$cond5$i = $624 & $625;
   $626 = ($622>>>0)<($623>>>0);
   $or$cond10$i = $626 & $or$cond5$i;
   if ($or$cond10$i) {
    $627 = $623;
    $628 = $622;
    $629 = (($627) - ($628))|0;
    $630 = (($nb$0) + 40)|0;
    $$not$i = ($629>>>0)>($630>>>0);
    if ($$not$i) {
     $tbase$746$i = $622;$tsize$745$i = $629;
     label = 193;
    }
   }
  }
 }
 if ((label|0) == 193) {
  $631 = HEAP32[(9464)>>2]|0;
  $632 = (($631) + ($tsize$745$i))|0;
  HEAP32[(9464)>>2] = $632;
  $633 = HEAP32[(9468)>>2]|0;
  $634 = ($632>>>0)>($633>>>0);
  if ($634) {
   HEAP32[(9468)>>2] = $632;
  }
  $635 = HEAP32[(9056)>>2]|0;
  $636 = ($635|0)==(0|0);
  do {
   if ($636) {
    $637 = HEAP32[(9048)>>2]|0;
    $638 = ($637|0)==(0|0);
    $639 = ($tbase$746$i>>>0)<($637>>>0);
    $or$cond11$i = $638 | $639;
    if ($or$cond11$i) {
     HEAP32[(9048)>>2] = $tbase$746$i;
    }
    HEAP32[(9480)>>2] = $tbase$746$i;
    HEAP32[(9484)>>2] = $tsize$745$i;
    HEAP32[(9492)>>2] = 0;
    $640 = HEAP32[2376]|0;
    HEAP32[(9068)>>2] = $640;
    HEAP32[(9064)>>2] = -1;
    $i$01$i$i = 0;
    while(1) {
     $641 = $i$01$i$i << 1;
     $642 = (9072 + ($641<<2)|0);
     $643 = ((($642)) + 12|0);
     HEAP32[$643>>2] = $642;
     $644 = ((($642)) + 8|0);
     HEAP32[$644>>2] = $642;
     $645 = (($i$01$i$i) + 1)|0;
     $exitcond$i$i = ($645|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $i$01$i$i = $645;
     }
    }
    $646 = (($tsize$745$i) + -40)|0;
    $647 = ((($tbase$746$i)) + 8|0);
    $648 = $647;
    $649 = $648 & 7;
    $650 = ($649|0)==(0);
    $651 = (0 - ($648))|0;
    $652 = $651 & 7;
    $653 = $650 ? 0 : $652;
    $654 = (($tbase$746$i) + ($653)|0);
    $655 = (($646) - ($653))|0;
    HEAP32[(9056)>>2] = $654;
    HEAP32[(9044)>>2] = $655;
    $656 = $655 | 1;
    $657 = ((($654)) + 4|0);
    HEAP32[$657>>2] = $656;
    $658 = (($654) + ($655)|0);
    $659 = ((($658)) + 4|0);
    HEAP32[$659>>2] = 40;
    $660 = HEAP32[(9520)>>2]|0;
    HEAP32[(9060)>>2] = $660;
   } else {
    $sp$068$i = (9480);
    while(1) {
     $661 = HEAP32[$sp$068$i>>2]|0;
     $662 = ((($sp$068$i)) + 4|0);
     $663 = HEAP32[$662>>2]|0;
     $664 = (($661) + ($663)|0);
     $665 = ($tbase$746$i|0)==($664|0);
     if ($665) {
      $$lcssa147 = $661;$$lcssa149 = $662;$$lcssa151 = $663;$sp$068$i$lcssa = $sp$068$i;
      label = 203;
      break;
     }
     $666 = ((($sp$068$i)) + 8|0);
     $667 = HEAP32[$666>>2]|0;
     $668 = ($667|0)==(0|0);
     if ($668) {
      break;
     } else {
      $sp$068$i = $667;
     }
    }
    if ((label|0) == 203) {
     $669 = ((($sp$068$i$lcssa)) + 12|0);
     $670 = HEAP32[$669>>2]|0;
     $671 = $670 & 8;
     $672 = ($671|0)==(0);
     if ($672) {
      $673 = ($635>>>0)>=($$lcssa147>>>0);
      $674 = ($635>>>0)<($tbase$746$i>>>0);
      $or$cond48$i = $674 & $673;
      if ($or$cond48$i) {
       $675 = (($$lcssa151) + ($tsize$745$i))|0;
       HEAP32[$$lcssa149>>2] = $675;
       $676 = HEAP32[(9044)>>2]|0;
       $677 = ((($635)) + 8|0);
       $678 = $677;
       $679 = $678 & 7;
       $680 = ($679|0)==(0);
       $681 = (0 - ($678))|0;
       $682 = $681 & 7;
       $683 = $680 ? 0 : $682;
       $684 = (($635) + ($683)|0);
       $685 = (($tsize$745$i) - ($683))|0;
       $686 = (($685) + ($676))|0;
       HEAP32[(9056)>>2] = $684;
       HEAP32[(9044)>>2] = $686;
       $687 = $686 | 1;
       $688 = ((($684)) + 4|0);
       HEAP32[$688>>2] = $687;
       $689 = (($684) + ($686)|0);
       $690 = ((($689)) + 4|0);
       HEAP32[$690>>2] = 40;
       $691 = HEAP32[(9520)>>2]|0;
       HEAP32[(9060)>>2] = $691;
       break;
      }
     }
    }
    $692 = HEAP32[(9048)>>2]|0;
    $693 = ($tbase$746$i>>>0)<($692>>>0);
    if ($693) {
     HEAP32[(9048)>>2] = $tbase$746$i;
     $757 = $tbase$746$i;
    } else {
     $757 = $692;
    }
    $694 = (($tbase$746$i) + ($tsize$745$i)|0);
    $sp$167$i = (9480);
    while(1) {
     $695 = HEAP32[$sp$167$i>>2]|0;
     $696 = ($695|0)==($694|0);
     if ($696) {
      $$lcssa144 = $sp$167$i;$sp$167$i$lcssa = $sp$167$i;
      label = 211;
      break;
     }
     $697 = ((($sp$167$i)) + 8|0);
     $698 = HEAP32[$697>>2]|0;
     $699 = ($698|0)==(0|0);
     if ($699) {
      $sp$0$i$i$i = (9480);
      break;
     } else {
      $sp$167$i = $698;
     }
    }
    if ((label|0) == 211) {
     $700 = ((($sp$167$i$lcssa)) + 12|0);
     $701 = HEAP32[$700>>2]|0;
     $702 = $701 & 8;
     $703 = ($702|0)==(0);
     if ($703) {
      HEAP32[$$lcssa144>>2] = $tbase$746$i;
      $704 = ((($sp$167$i$lcssa)) + 4|0);
      $705 = HEAP32[$704>>2]|0;
      $706 = (($705) + ($tsize$745$i))|0;
      HEAP32[$704>>2] = $706;
      $707 = ((($tbase$746$i)) + 8|0);
      $708 = $707;
      $709 = $708 & 7;
      $710 = ($709|0)==(0);
      $711 = (0 - ($708))|0;
      $712 = $711 & 7;
      $713 = $710 ? 0 : $712;
      $714 = (($tbase$746$i) + ($713)|0);
      $715 = ((($694)) + 8|0);
      $716 = $715;
      $717 = $716 & 7;
      $718 = ($717|0)==(0);
      $719 = (0 - ($716))|0;
      $720 = $719 & 7;
      $721 = $718 ? 0 : $720;
      $722 = (($694) + ($721)|0);
      $723 = $722;
      $724 = $714;
      $725 = (($723) - ($724))|0;
      $726 = (($714) + ($nb$0)|0);
      $727 = (($725) - ($nb$0))|0;
      $728 = $nb$0 | 3;
      $729 = ((($714)) + 4|0);
      HEAP32[$729>>2] = $728;
      $730 = ($722|0)==($635|0);
      do {
       if ($730) {
        $731 = HEAP32[(9044)>>2]|0;
        $732 = (($731) + ($727))|0;
        HEAP32[(9044)>>2] = $732;
        HEAP32[(9056)>>2] = $726;
        $733 = $732 | 1;
        $734 = ((($726)) + 4|0);
        HEAP32[$734>>2] = $733;
       } else {
        $735 = HEAP32[(9052)>>2]|0;
        $736 = ($722|0)==($735|0);
        if ($736) {
         $737 = HEAP32[(9040)>>2]|0;
         $738 = (($737) + ($727))|0;
         HEAP32[(9040)>>2] = $738;
         HEAP32[(9052)>>2] = $726;
         $739 = $738 | 1;
         $740 = ((($726)) + 4|0);
         HEAP32[$740>>2] = $739;
         $741 = (($726) + ($738)|0);
         HEAP32[$741>>2] = $738;
         break;
        }
        $742 = ((($722)) + 4|0);
        $743 = HEAP32[$742>>2]|0;
        $744 = $743 & 3;
        $745 = ($744|0)==(1);
        if ($745) {
         $746 = $743 & -8;
         $747 = $743 >>> 3;
         $748 = ($743>>>0)<(256);
         L331: do {
          if ($748) {
           $749 = ((($722)) + 8|0);
           $750 = HEAP32[$749>>2]|0;
           $751 = ((($722)) + 12|0);
           $752 = HEAP32[$751>>2]|0;
           $753 = $747 << 1;
           $754 = (9072 + ($753<<2)|0);
           $755 = ($750|0)==($754|0);
           do {
            if (!($755)) {
             $756 = ($750>>>0)<($757>>>0);
             if ($756) {
              _abort();
              // unreachable;
             }
             $758 = ((($750)) + 12|0);
             $759 = HEAP32[$758>>2]|0;
             $760 = ($759|0)==($722|0);
             if ($760) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $761 = ($752|0)==($750|0);
           if ($761) {
            $762 = 1 << $747;
            $763 = $762 ^ -1;
            $764 = HEAP32[2258]|0;
            $765 = $764 & $763;
            HEAP32[2258] = $765;
            break;
           }
           $766 = ($752|0)==($754|0);
           do {
            if ($766) {
             $$pre9$i$i = ((($752)) + 8|0);
             $$pre$phi10$i$iZ2D = $$pre9$i$i;
            } else {
             $767 = ($752>>>0)<($757>>>0);
             if ($767) {
              _abort();
              // unreachable;
             }
             $768 = ((($752)) + 8|0);
             $769 = HEAP32[$768>>2]|0;
             $770 = ($769|0)==($722|0);
             if ($770) {
              $$pre$phi10$i$iZ2D = $768;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $771 = ((($750)) + 12|0);
           HEAP32[$771>>2] = $752;
           HEAP32[$$pre$phi10$i$iZ2D>>2] = $750;
          } else {
           $772 = ((($722)) + 24|0);
           $773 = HEAP32[$772>>2]|0;
           $774 = ((($722)) + 12|0);
           $775 = HEAP32[$774>>2]|0;
           $776 = ($775|0)==($722|0);
           do {
            if ($776) {
             $786 = ((($722)) + 16|0);
             $787 = ((($786)) + 4|0);
             $788 = HEAP32[$787>>2]|0;
             $789 = ($788|0)==(0|0);
             if ($789) {
              $790 = HEAP32[$786>>2]|0;
              $791 = ($790|0)==(0|0);
              if ($791) {
               $R$3$i$i = 0;
               break;
              } else {
               $R$1$i$i = $790;$RP$1$i$i = $786;
              }
             } else {
              $R$1$i$i = $788;$RP$1$i$i = $787;
             }
             while(1) {
              $792 = ((($R$1$i$i)) + 20|0);
              $793 = HEAP32[$792>>2]|0;
              $794 = ($793|0)==(0|0);
              if (!($794)) {
               $R$1$i$i = $793;$RP$1$i$i = $792;
               continue;
              }
              $795 = ((($R$1$i$i)) + 16|0);
              $796 = HEAP32[$795>>2]|0;
              $797 = ($796|0)==(0|0);
              if ($797) {
               $R$1$i$i$lcssa = $R$1$i$i;$RP$1$i$i$lcssa = $RP$1$i$i;
               break;
              } else {
               $R$1$i$i = $796;$RP$1$i$i = $795;
              }
             }
             $798 = ($RP$1$i$i$lcssa>>>0)<($757>>>0);
             if ($798) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$RP$1$i$i$lcssa>>2] = 0;
              $R$3$i$i = $R$1$i$i$lcssa;
              break;
             }
            } else {
             $777 = ((($722)) + 8|0);
             $778 = HEAP32[$777>>2]|0;
             $779 = ($778>>>0)<($757>>>0);
             if ($779) {
              _abort();
              // unreachable;
             }
             $780 = ((($778)) + 12|0);
             $781 = HEAP32[$780>>2]|0;
             $782 = ($781|0)==($722|0);
             if (!($782)) {
              _abort();
              // unreachable;
             }
             $783 = ((($775)) + 8|0);
             $784 = HEAP32[$783>>2]|0;
             $785 = ($784|0)==($722|0);
             if ($785) {
              HEAP32[$780>>2] = $775;
              HEAP32[$783>>2] = $778;
              $R$3$i$i = $775;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $799 = ($773|0)==(0|0);
           if ($799) {
            break;
           }
           $800 = ((($722)) + 28|0);
           $801 = HEAP32[$800>>2]|0;
           $802 = (9336 + ($801<<2)|0);
           $803 = HEAP32[$802>>2]|0;
           $804 = ($722|0)==($803|0);
           do {
            if ($804) {
             HEAP32[$802>>2] = $R$3$i$i;
             $cond$i$i = ($R$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $805 = 1 << $801;
             $806 = $805 ^ -1;
             $807 = HEAP32[(9036)>>2]|0;
             $808 = $807 & $806;
             HEAP32[(9036)>>2] = $808;
             break L331;
            } else {
             $809 = HEAP32[(9048)>>2]|0;
             $810 = ($773>>>0)<($809>>>0);
             if ($810) {
              _abort();
              // unreachable;
             }
             $811 = ((($773)) + 16|0);
             $812 = HEAP32[$811>>2]|0;
             $813 = ($812|0)==($722|0);
             if ($813) {
              HEAP32[$811>>2] = $R$3$i$i;
             } else {
              $814 = ((($773)) + 20|0);
              HEAP32[$814>>2] = $R$3$i$i;
             }
             $815 = ($R$3$i$i|0)==(0|0);
             if ($815) {
              break L331;
             }
            }
           } while(0);
           $816 = HEAP32[(9048)>>2]|0;
           $817 = ($R$3$i$i>>>0)<($816>>>0);
           if ($817) {
            _abort();
            // unreachable;
           }
           $818 = ((($R$3$i$i)) + 24|0);
           HEAP32[$818>>2] = $773;
           $819 = ((($722)) + 16|0);
           $820 = HEAP32[$819>>2]|0;
           $821 = ($820|0)==(0|0);
           do {
            if (!($821)) {
             $822 = ($820>>>0)<($816>>>0);
             if ($822) {
              _abort();
              // unreachable;
             } else {
              $823 = ((($R$3$i$i)) + 16|0);
              HEAP32[$823>>2] = $820;
              $824 = ((($820)) + 24|0);
              HEAP32[$824>>2] = $R$3$i$i;
              break;
             }
            }
           } while(0);
           $825 = ((($819)) + 4|0);
           $826 = HEAP32[$825>>2]|0;
           $827 = ($826|0)==(0|0);
           if ($827) {
            break;
           }
           $828 = HEAP32[(9048)>>2]|0;
           $829 = ($826>>>0)<($828>>>0);
           if ($829) {
            _abort();
            // unreachable;
           } else {
            $830 = ((($R$3$i$i)) + 20|0);
            HEAP32[$830>>2] = $826;
            $831 = ((($826)) + 24|0);
            HEAP32[$831>>2] = $R$3$i$i;
            break;
           }
          }
         } while(0);
         $832 = (($722) + ($746)|0);
         $833 = (($746) + ($727))|0;
         $oldfirst$0$i$i = $832;$qsize$0$i$i = $833;
        } else {
         $oldfirst$0$i$i = $722;$qsize$0$i$i = $727;
        }
        $834 = ((($oldfirst$0$i$i)) + 4|0);
        $835 = HEAP32[$834>>2]|0;
        $836 = $835 & -2;
        HEAP32[$834>>2] = $836;
        $837 = $qsize$0$i$i | 1;
        $838 = ((($726)) + 4|0);
        HEAP32[$838>>2] = $837;
        $839 = (($726) + ($qsize$0$i$i)|0);
        HEAP32[$839>>2] = $qsize$0$i$i;
        $840 = $qsize$0$i$i >>> 3;
        $841 = ($qsize$0$i$i>>>0)<(256);
        if ($841) {
         $842 = $840 << 1;
         $843 = (9072 + ($842<<2)|0);
         $844 = HEAP32[2258]|0;
         $845 = 1 << $840;
         $846 = $844 & $845;
         $847 = ($846|0)==(0);
         do {
          if ($847) {
           $848 = $844 | $845;
           HEAP32[2258] = $848;
           $$pre$i16$i = ((($843)) + 8|0);
           $$pre$phi$i17$iZ2D = $$pre$i16$i;$F4$0$i$i = $843;
          } else {
           $849 = ((($843)) + 8|0);
           $850 = HEAP32[$849>>2]|0;
           $851 = HEAP32[(9048)>>2]|0;
           $852 = ($850>>>0)<($851>>>0);
           if (!($852)) {
            $$pre$phi$i17$iZ2D = $849;$F4$0$i$i = $850;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i17$iZ2D>>2] = $726;
         $853 = ((($F4$0$i$i)) + 12|0);
         HEAP32[$853>>2] = $726;
         $854 = ((($726)) + 8|0);
         HEAP32[$854>>2] = $F4$0$i$i;
         $855 = ((($726)) + 12|0);
         HEAP32[$855>>2] = $843;
         break;
        }
        $856 = $qsize$0$i$i >>> 8;
        $857 = ($856|0)==(0);
        do {
         if ($857) {
          $I7$0$i$i = 0;
         } else {
          $858 = ($qsize$0$i$i>>>0)>(16777215);
          if ($858) {
           $I7$0$i$i = 31;
           break;
          }
          $859 = (($856) + 1048320)|0;
          $860 = $859 >>> 16;
          $861 = $860 & 8;
          $862 = $856 << $861;
          $863 = (($862) + 520192)|0;
          $864 = $863 >>> 16;
          $865 = $864 & 4;
          $866 = $865 | $861;
          $867 = $862 << $865;
          $868 = (($867) + 245760)|0;
          $869 = $868 >>> 16;
          $870 = $869 & 2;
          $871 = $866 | $870;
          $872 = (14 - ($871))|0;
          $873 = $867 << $870;
          $874 = $873 >>> 15;
          $875 = (($872) + ($874))|0;
          $876 = $875 << 1;
          $877 = (($875) + 7)|0;
          $878 = $qsize$0$i$i >>> $877;
          $879 = $878 & 1;
          $880 = $879 | $876;
          $I7$0$i$i = $880;
         }
        } while(0);
        $881 = (9336 + ($I7$0$i$i<<2)|0);
        $882 = ((($726)) + 28|0);
        HEAP32[$882>>2] = $I7$0$i$i;
        $883 = ((($726)) + 16|0);
        $884 = ((($883)) + 4|0);
        HEAP32[$884>>2] = 0;
        HEAP32[$883>>2] = 0;
        $885 = HEAP32[(9036)>>2]|0;
        $886 = 1 << $I7$0$i$i;
        $887 = $885 & $886;
        $888 = ($887|0)==(0);
        if ($888) {
         $889 = $885 | $886;
         HEAP32[(9036)>>2] = $889;
         HEAP32[$881>>2] = $726;
         $890 = ((($726)) + 24|0);
         HEAP32[$890>>2] = $881;
         $891 = ((($726)) + 12|0);
         HEAP32[$891>>2] = $726;
         $892 = ((($726)) + 8|0);
         HEAP32[$892>>2] = $726;
         break;
        }
        $893 = HEAP32[$881>>2]|0;
        $894 = ($I7$0$i$i|0)==(31);
        $895 = $I7$0$i$i >>> 1;
        $896 = (25 - ($895))|0;
        $897 = $894 ? 0 : $896;
        $898 = $qsize$0$i$i << $897;
        $K8$0$i$i = $898;$T$0$i18$i = $893;
        while(1) {
         $899 = ((($T$0$i18$i)) + 4|0);
         $900 = HEAP32[$899>>2]|0;
         $901 = $900 & -8;
         $902 = ($901|0)==($qsize$0$i$i|0);
         if ($902) {
          $T$0$i18$i$lcssa = $T$0$i18$i;
          label = 281;
          break;
         }
         $903 = $K8$0$i$i >>> 31;
         $904 = (((($T$0$i18$i)) + 16|0) + ($903<<2)|0);
         $905 = $K8$0$i$i << 1;
         $906 = HEAP32[$904>>2]|0;
         $907 = ($906|0)==(0|0);
         if ($907) {
          $$lcssa = $904;$T$0$i18$i$lcssa139 = $T$0$i18$i;
          label = 278;
          break;
         } else {
          $K8$0$i$i = $905;$T$0$i18$i = $906;
         }
        }
        if ((label|0) == 278) {
         $908 = HEAP32[(9048)>>2]|0;
         $909 = ($$lcssa>>>0)<($908>>>0);
         if ($909) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$$lcssa>>2] = $726;
          $910 = ((($726)) + 24|0);
          HEAP32[$910>>2] = $T$0$i18$i$lcssa139;
          $911 = ((($726)) + 12|0);
          HEAP32[$911>>2] = $726;
          $912 = ((($726)) + 8|0);
          HEAP32[$912>>2] = $726;
          break;
         }
        }
        else if ((label|0) == 281) {
         $913 = ((($T$0$i18$i$lcssa)) + 8|0);
         $914 = HEAP32[$913>>2]|0;
         $915 = HEAP32[(9048)>>2]|0;
         $916 = ($914>>>0)>=($915>>>0);
         $not$$i20$i = ($T$0$i18$i$lcssa>>>0)>=($915>>>0);
         $917 = $916 & $not$$i20$i;
         if ($917) {
          $918 = ((($914)) + 12|0);
          HEAP32[$918>>2] = $726;
          HEAP32[$913>>2] = $726;
          $919 = ((($726)) + 8|0);
          HEAP32[$919>>2] = $914;
          $920 = ((($726)) + 12|0);
          HEAP32[$920>>2] = $T$0$i18$i$lcssa;
          $921 = ((($726)) + 24|0);
          HEAP32[$921>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       }
      } while(0);
      $1052 = ((($714)) + 8|0);
      $$0 = $1052;
      return ($$0|0);
     } else {
      $sp$0$i$i$i = (9480);
     }
    }
    while(1) {
     $922 = HEAP32[$sp$0$i$i$i>>2]|0;
     $923 = ($922>>>0)>($635>>>0);
     if (!($923)) {
      $924 = ((($sp$0$i$i$i)) + 4|0);
      $925 = HEAP32[$924>>2]|0;
      $926 = (($922) + ($925)|0);
      $927 = ($926>>>0)>($635>>>0);
      if ($927) {
       $$lcssa142 = $926;
       break;
      }
     }
     $928 = ((($sp$0$i$i$i)) + 8|0);
     $929 = HEAP32[$928>>2]|0;
     $sp$0$i$i$i = $929;
    }
    $930 = ((($$lcssa142)) + -47|0);
    $931 = ((($930)) + 8|0);
    $932 = $931;
    $933 = $932 & 7;
    $934 = ($933|0)==(0);
    $935 = (0 - ($932))|0;
    $936 = $935 & 7;
    $937 = $934 ? 0 : $936;
    $938 = (($930) + ($937)|0);
    $939 = ((($635)) + 16|0);
    $940 = ($938>>>0)<($939>>>0);
    $941 = $940 ? $635 : $938;
    $942 = ((($941)) + 8|0);
    $943 = ((($941)) + 24|0);
    $944 = (($tsize$745$i) + -40)|0;
    $945 = ((($tbase$746$i)) + 8|0);
    $946 = $945;
    $947 = $946 & 7;
    $948 = ($947|0)==(0);
    $949 = (0 - ($946))|0;
    $950 = $949 & 7;
    $951 = $948 ? 0 : $950;
    $952 = (($tbase$746$i) + ($951)|0);
    $953 = (($944) - ($951))|0;
    HEAP32[(9056)>>2] = $952;
    HEAP32[(9044)>>2] = $953;
    $954 = $953 | 1;
    $955 = ((($952)) + 4|0);
    HEAP32[$955>>2] = $954;
    $956 = (($952) + ($953)|0);
    $957 = ((($956)) + 4|0);
    HEAP32[$957>>2] = 40;
    $958 = HEAP32[(9520)>>2]|0;
    HEAP32[(9060)>>2] = $958;
    $959 = ((($941)) + 4|0);
    HEAP32[$959>>2] = 27;
    ;HEAP32[$942>>2]=HEAP32[(9480)>>2]|0;HEAP32[$942+4>>2]=HEAP32[(9480)+4>>2]|0;HEAP32[$942+8>>2]=HEAP32[(9480)+8>>2]|0;HEAP32[$942+12>>2]=HEAP32[(9480)+12>>2]|0;
    HEAP32[(9480)>>2] = $tbase$746$i;
    HEAP32[(9484)>>2] = $tsize$745$i;
    HEAP32[(9492)>>2] = 0;
    HEAP32[(9488)>>2] = $942;
    $p$0$i$i = $943;
    while(1) {
     $960 = ((($p$0$i$i)) + 4|0);
     HEAP32[$960>>2] = 7;
     $961 = ((($960)) + 4|0);
     $962 = ($961>>>0)<($$lcssa142>>>0);
     if ($962) {
      $p$0$i$i = $960;
     } else {
      break;
     }
    }
    $963 = ($941|0)==($635|0);
    if (!($963)) {
     $964 = $941;
     $965 = $635;
     $966 = (($964) - ($965))|0;
     $967 = HEAP32[$959>>2]|0;
     $968 = $967 & -2;
     HEAP32[$959>>2] = $968;
     $969 = $966 | 1;
     $970 = ((($635)) + 4|0);
     HEAP32[$970>>2] = $969;
     HEAP32[$941>>2] = $966;
     $971 = $966 >>> 3;
     $972 = ($966>>>0)<(256);
     if ($972) {
      $973 = $971 << 1;
      $974 = (9072 + ($973<<2)|0);
      $975 = HEAP32[2258]|0;
      $976 = 1 << $971;
      $977 = $975 & $976;
      $978 = ($977|0)==(0);
      if ($978) {
       $979 = $975 | $976;
       HEAP32[2258] = $979;
       $$pre$i$i = ((($974)) + 8|0);
       $$pre$phi$i$iZ2D = $$pre$i$i;$F$0$i$i = $974;
      } else {
       $980 = ((($974)) + 8|0);
       $981 = HEAP32[$980>>2]|0;
       $982 = HEAP32[(9048)>>2]|0;
       $983 = ($981>>>0)<($982>>>0);
       if ($983) {
        _abort();
        // unreachable;
       } else {
        $$pre$phi$i$iZ2D = $980;$F$0$i$i = $981;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $635;
      $984 = ((($F$0$i$i)) + 12|0);
      HEAP32[$984>>2] = $635;
      $985 = ((($635)) + 8|0);
      HEAP32[$985>>2] = $F$0$i$i;
      $986 = ((($635)) + 12|0);
      HEAP32[$986>>2] = $974;
      break;
     }
     $987 = $966 >>> 8;
     $988 = ($987|0)==(0);
     if ($988) {
      $I1$0$i$i = 0;
     } else {
      $989 = ($966>>>0)>(16777215);
      if ($989) {
       $I1$0$i$i = 31;
      } else {
       $990 = (($987) + 1048320)|0;
       $991 = $990 >>> 16;
       $992 = $991 & 8;
       $993 = $987 << $992;
       $994 = (($993) + 520192)|0;
       $995 = $994 >>> 16;
       $996 = $995 & 4;
       $997 = $996 | $992;
       $998 = $993 << $996;
       $999 = (($998) + 245760)|0;
       $1000 = $999 >>> 16;
       $1001 = $1000 & 2;
       $1002 = $997 | $1001;
       $1003 = (14 - ($1002))|0;
       $1004 = $998 << $1001;
       $1005 = $1004 >>> 15;
       $1006 = (($1003) + ($1005))|0;
       $1007 = $1006 << 1;
       $1008 = (($1006) + 7)|0;
       $1009 = $966 >>> $1008;
       $1010 = $1009 & 1;
       $1011 = $1010 | $1007;
       $I1$0$i$i = $1011;
      }
     }
     $1012 = (9336 + ($I1$0$i$i<<2)|0);
     $1013 = ((($635)) + 28|0);
     HEAP32[$1013>>2] = $I1$0$i$i;
     $1014 = ((($635)) + 20|0);
     HEAP32[$1014>>2] = 0;
     HEAP32[$939>>2] = 0;
     $1015 = HEAP32[(9036)>>2]|0;
     $1016 = 1 << $I1$0$i$i;
     $1017 = $1015 & $1016;
     $1018 = ($1017|0)==(0);
     if ($1018) {
      $1019 = $1015 | $1016;
      HEAP32[(9036)>>2] = $1019;
      HEAP32[$1012>>2] = $635;
      $1020 = ((($635)) + 24|0);
      HEAP32[$1020>>2] = $1012;
      $1021 = ((($635)) + 12|0);
      HEAP32[$1021>>2] = $635;
      $1022 = ((($635)) + 8|0);
      HEAP32[$1022>>2] = $635;
      break;
     }
     $1023 = HEAP32[$1012>>2]|0;
     $1024 = ($I1$0$i$i|0)==(31);
     $1025 = $I1$0$i$i >>> 1;
     $1026 = (25 - ($1025))|0;
     $1027 = $1024 ? 0 : $1026;
     $1028 = $966 << $1027;
     $K2$0$i$i = $1028;$T$0$i$i = $1023;
     while(1) {
      $1029 = ((($T$0$i$i)) + 4|0);
      $1030 = HEAP32[$1029>>2]|0;
      $1031 = $1030 & -8;
      $1032 = ($1031|0)==($966|0);
      if ($1032) {
       $T$0$i$i$lcssa = $T$0$i$i;
       label = 307;
       break;
      }
      $1033 = $K2$0$i$i >>> 31;
      $1034 = (((($T$0$i$i)) + 16|0) + ($1033<<2)|0);
      $1035 = $K2$0$i$i << 1;
      $1036 = HEAP32[$1034>>2]|0;
      $1037 = ($1036|0)==(0|0);
      if ($1037) {
       $$lcssa141 = $1034;$T$0$i$i$lcssa140 = $T$0$i$i;
       label = 304;
       break;
      } else {
       $K2$0$i$i = $1035;$T$0$i$i = $1036;
      }
     }
     if ((label|0) == 304) {
      $1038 = HEAP32[(9048)>>2]|0;
      $1039 = ($$lcssa141>>>0)<($1038>>>0);
      if ($1039) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$$lcssa141>>2] = $635;
       $1040 = ((($635)) + 24|0);
       HEAP32[$1040>>2] = $T$0$i$i$lcssa140;
       $1041 = ((($635)) + 12|0);
       HEAP32[$1041>>2] = $635;
       $1042 = ((($635)) + 8|0);
       HEAP32[$1042>>2] = $635;
       break;
      }
     }
     else if ((label|0) == 307) {
      $1043 = ((($T$0$i$i$lcssa)) + 8|0);
      $1044 = HEAP32[$1043>>2]|0;
      $1045 = HEAP32[(9048)>>2]|0;
      $1046 = ($1044>>>0)>=($1045>>>0);
      $not$$i$i = ($T$0$i$i$lcssa>>>0)>=($1045>>>0);
      $1047 = $1046 & $not$$i$i;
      if ($1047) {
       $1048 = ((($1044)) + 12|0);
       HEAP32[$1048>>2] = $635;
       HEAP32[$1043>>2] = $635;
       $1049 = ((($635)) + 8|0);
       HEAP32[$1049>>2] = $1044;
       $1050 = ((($635)) + 12|0);
       HEAP32[$1050>>2] = $T$0$i$i$lcssa;
       $1051 = ((($635)) + 24|0);
       HEAP32[$1051>>2] = 0;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    }
   }
  } while(0);
  $1053 = HEAP32[(9044)>>2]|0;
  $1054 = ($1053>>>0)>($nb$0>>>0);
  if ($1054) {
   $1055 = (($1053) - ($nb$0))|0;
   HEAP32[(9044)>>2] = $1055;
   $1056 = HEAP32[(9056)>>2]|0;
   $1057 = (($1056) + ($nb$0)|0);
   HEAP32[(9056)>>2] = $1057;
   $1058 = $1055 | 1;
   $1059 = ((($1057)) + 4|0);
   HEAP32[$1059>>2] = $1058;
   $1060 = $nb$0 | 3;
   $1061 = ((($1056)) + 4|0);
   HEAP32[$1061>>2] = $1060;
   $1062 = ((($1056)) + 8|0);
   $$0 = $1062;
   return ($$0|0);
  }
 }
 $1063 = (___errno_location()|0);
 HEAP32[$1063>>2] = 12;
 $$0 = 0;
 return ($$0|0);
}
function _free($mem) {
 $mem = $mem|0;
 var $$lcssa = 0, $$pre = 0, $$pre$phi41Z2D = 0, $$pre$phi43Z2D = 0, $$pre$phiZ2D = 0, $$pre40 = 0, $$pre42 = 0, $0 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0;
 var $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0;
 var $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0;
 var $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0;
 var $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0;
 var $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0;
 var $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0;
 var $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0;
 var $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0;
 var $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0;
 var $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0;
 var $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0;
 var $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0;
 var $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0;
 var $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0;
 var $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0;
 var $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $F18$0 = 0, $I20$0 = 0, $K21$0 = 0, $R$1 = 0, $R$1$lcssa = 0, $R$3 = 0, $R8$1 = 0, $R8$1$lcssa = 0, $R8$3 = 0, $RP$1 = 0, $RP$1$lcssa = 0, $RP10$1 = 0, $RP10$1$lcssa = 0;
 var $T$0 = 0, $T$0$lcssa = 0, $T$0$lcssa48 = 0, $cond20 = 0, $cond21 = 0, $not$ = 0, $p$1 = 0, $psize$1 = 0, $psize$2 = 0, $sp$0$i = 0, $sp$0$in$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($mem|0)==(0|0);
 if ($0) {
  return;
 }
 $1 = ((($mem)) + -8|0);
 $2 = HEAP32[(9048)>>2]|0;
 $3 = ($1>>>0)<($2>>>0);
 if ($3) {
  _abort();
  // unreachable;
 }
 $4 = ((($mem)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & 3;
 $7 = ($6|0)==(1);
 if ($7) {
  _abort();
  // unreachable;
 }
 $8 = $5 & -8;
 $9 = (($1) + ($8)|0);
 $10 = $5 & 1;
 $11 = ($10|0)==(0);
 do {
  if ($11) {
   $12 = HEAP32[$1>>2]|0;
   $13 = ($6|0)==(0);
   if ($13) {
    return;
   }
   $14 = (0 - ($12))|0;
   $15 = (($1) + ($14)|0);
   $16 = (($12) + ($8))|0;
   $17 = ($15>>>0)<($2>>>0);
   if ($17) {
    _abort();
    // unreachable;
   }
   $18 = HEAP32[(9052)>>2]|0;
   $19 = ($15|0)==($18|0);
   if ($19) {
    $104 = ((($9)) + 4|0);
    $105 = HEAP32[$104>>2]|0;
    $106 = $105 & 3;
    $107 = ($106|0)==(3);
    if (!($107)) {
     $p$1 = $15;$psize$1 = $16;
     break;
    }
    HEAP32[(9040)>>2] = $16;
    $108 = $105 & -2;
    HEAP32[$104>>2] = $108;
    $109 = $16 | 1;
    $110 = ((($15)) + 4|0);
    HEAP32[$110>>2] = $109;
    $111 = (($15) + ($16)|0);
    HEAP32[$111>>2] = $16;
    return;
   }
   $20 = $12 >>> 3;
   $21 = ($12>>>0)<(256);
   if ($21) {
    $22 = ((($15)) + 8|0);
    $23 = HEAP32[$22>>2]|0;
    $24 = ((($15)) + 12|0);
    $25 = HEAP32[$24>>2]|0;
    $26 = $20 << 1;
    $27 = (9072 + ($26<<2)|0);
    $28 = ($23|0)==($27|0);
    if (!($28)) {
     $29 = ($23>>>0)<($2>>>0);
     if ($29) {
      _abort();
      // unreachable;
     }
     $30 = ((($23)) + 12|0);
     $31 = HEAP32[$30>>2]|0;
     $32 = ($31|0)==($15|0);
     if (!($32)) {
      _abort();
      // unreachable;
     }
    }
    $33 = ($25|0)==($23|0);
    if ($33) {
     $34 = 1 << $20;
     $35 = $34 ^ -1;
     $36 = HEAP32[2258]|0;
     $37 = $36 & $35;
     HEAP32[2258] = $37;
     $p$1 = $15;$psize$1 = $16;
     break;
    }
    $38 = ($25|0)==($27|0);
    if ($38) {
     $$pre42 = ((($25)) + 8|0);
     $$pre$phi43Z2D = $$pre42;
    } else {
     $39 = ($25>>>0)<($2>>>0);
     if ($39) {
      _abort();
      // unreachable;
     }
     $40 = ((($25)) + 8|0);
     $41 = HEAP32[$40>>2]|0;
     $42 = ($41|0)==($15|0);
     if ($42) {
      $$pre$phi43Z2D = $40;
     } else {
      _abort();
      // unreachable;
     }
    }
    $43 = ((($23)) + 12|0);
    HEAP32[$43>>2] = $25;
    HEAP32[$$pre$phi43Z2D>>2] = $23;
    $p$1 = $15;$psize$1 = $16;
    break;
   }
   $44 = ((($15)) + 24|0);
   $45 = HEAP32[$44>>2]|0;
   $46 = ((($15)) + 12|0);
   $47 = HEAP32[$46>>2]|0;
   $48 = ($47|0)==($15|0);
   do {
    if ($48) {
     $58 = ((($15)) + 16|0);
     $59 = ((($58)) + 4|0);
     $60 = HEAP32[$59>>2]|0;
     $61 = ($60|0)==(0|0);
     if ($61) {
      $62 = HEAP32[$58>>2]|0;
      $63 = ($62|0)==(0|0);
      if ($63) {
       $R$3 = 0;
       break;
      } else {
       $R$1 = $62;$RP$1 = $58;
      }
     } else {
      $R$1 = $60;$RP$1 = $59;
     }
     while(1) {
      $64 = ((($R$1)) + 20|0);
      $65 = HEAP32[$64>>2]|0;
      $66 = ($65|0)==(0|0);
      if (!($66)) {
       $R$1 = $65;$RP$1 = $64;
       continue;
      }
      $67 = ((($R$1)) + 16|0);
      $68 = HEAP32[$67>>2]|0;
      $69 = ($68|0)==(0|0);
      if ($69) {
       $R$1$lcssa = $R$1;$RP$1$lcssa = $RP$1;
       break;
      } else {
       $R$1 = $68;$RP$1 = $67;
      }
     }
     $70 = ($RP$1$lcssa>>>0)<($2>>>0);
     if ($70) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$RP$1$lcssa>>2] = 0;
      $R$3 = $R$1$lcssa;
      break;
     }
    } else {
     $49 = ((($15)) + 8|0);
     $50 = HEAP32[$49>>2]|0;
     $51 = ($50>>>0)<($2>>>0);
     if ($51) {
      _abort();
      // unreachable;
     }
     $52 = ((($50)) + 12|0);
     $53 = HEAP32[$52>>2]|0;
     $54 = ($53|0)==($15|0);
     if (!($54)) {
      _abort();
      // unreachable;
     }
     $55 = ((($47)) + 8|0);
     $56 = HEAP32[$55>>2]|0;
     $57 = ($56|0)==($15|0);
     if ($57) {
      HEAP32[$52>>2] = $47;
      HEAP32[$55>>2] = $50;
      $R$3 = $47;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $71 = ($45|0)==(0|0);
   if ($71) {
    $p$1 = $15;$psize$1 = $16;
   } else {
    $72 = ((($15)) + 28|0);
    $73 = HEAP32[$72>>2]|0;
    $74 = (9336 + ($73<<2)|0);
    $75 = HEAP32[$74>>2]|0;
    $76 = ($15|0)==($75|0);
    if ($76) {
     HEAP32[$74>>2] = $R$3;
     $cond20 = ($R$3|0)==(0|0);
     if ($cond20) {
      $77 = 1 << $73;
      $78 = $77 ^ -1;
      $79 = HEAP32[(9036)>>2]|0;
      $80 = $79 & $78;
      HEAP32[(9036)>>2] = $80;
      $p$1 = $15;$psize$1 = $16;
      break;
     }
    } else {
     $81 = HEAP32[(9048)>>2]|0;
     $82 = ($45>>>0)<($81>>>0);
     if ($82) {
      _abort();
      // unreachable;
     }
     $83 = ((($45)) + 16|0);
     $84 = HEAP32[$83>>2]|0;
     $85 = ($84|0)==($15|0);
     if ($85) {
      HEAP32[$83>>2] = $R$3;
     } else {
      $86 = ((($45)) + 20|0);
      HEAP32[$86>>2] = $R$3;
     }
     $87 = ($R$3|0)==(0|0);
     if ($87) {
      $p$1 = $15;$psize$1 = $16;
      break;
     }
    }
    $88 = HEAP32[(9048)>>2]|0;
    $89 = ($R$3>>>0)<($88>>>0);
    if ($89) {
     _abort();
     // unreachable;
    }
    $90 = ((($R$3)) + 24|0);
    HEAP32[$90>>2] = $45;
    $91 = ((($15)) + 16|0);
    $92 = HEAP32[$91>>2]|0;
    $93 = ($92|0)==(0|0);
    do {
     if (!($93)) {
      $94 = ($92>>>0)<($88>>>0);
      if ($94) {
       _abort();
       // unreachable;
      } else {
       $95 = ((($R$3)) + 16|0);
       HEAP32[$95>>2] = $92;
       $96 = ((($92)) + 24|0);
       HEAP32[$96>>2] = $R$3;
       break;
      }
     }
    } while(0);
    $97 = ((($91)) + 4|0);
    $98 = HEAP32[$97>>2]|0;
    $99 = ($98|0)==(0|0);
    if ($99) {
     $p$1 = $15;$psize$1 = $16;
    } else {
     $100 = HEAP32[(9048)>>2]|0;
     $101 = ($98>>>0)<($100>>>0);
     if ($101) {
      _abort();
      // unreachable;
     } else {
      $102 = ((($R$3)) + 20|0);
      HEAP32[$102>>2] = $98;
      $103 = ((($98)) + 24|0);
      HEAP32[$103>>2] = $R$3;
      $p$1 = $15;$psize$1 = $16;
      break;
     }
    }
   }
  } else {
   $p$1 = $1;$psize$1 = $8;
  }
 } while(0);
 $112 = ($p$1>>>0)<($9>>>0);
 if (!($112)) {
  _abort();
  // unreachable;
 }
 $113 = ((($9)) + 4|0);
 $114 = HEAP32[$113>>2]|0;
 $115 = $114 & 1;
 $116 = ($115|0)==(0);
 if ($116) {
  _abort();
  // unreachable;
 }
 $117 = $114 & 2;
 $118 = ($117|0)==(0);
 if ($118) {
  $119 = HEAP32[(9056)>>2]|0;
  $120 = ($9|0)==($119|0);
  if ($120) {
   $121 = HEAP32[(9044)>>2]|0;
   $122 = (($121) + ($psize$1))|0;
   HEAP32[(9044)>>2] = $122;
   HEAP32[(9056)>>2] = $p$1;
   $123 = $122 | 1;
   $124 = ((($p$1)) + 4|0);
   HEAP32[$124>>2] = $123;
   $125 = HEAP32[(9052)>>2]|0;
   $126 = ($p$1|0)==($125|0);
   if (!($126)) {
    return;
   }
   HEAP32[(9052)>>2] = 0;
   HEAP32[(9040)>>2] = 0;
   return;
  }
  $127 = HEAP32[(9052)>>2]|0;
  $128 = ($9|0)==($127|0);
  if ($128) {
   $129 = HEAP32[(9040)>>2]|0;
   $130 = (($129) + ($psize$1))|0;
   HEAP32[(9040)>>2] = $130;
   HEAP32[(9052)>>2] = $p$1;
   $131 = $130 | 1;
   $132 = ((($p$1)) + 4|0);
   HEAP32[$132>>2] = $131;
   $133 = (($p$1) + ($130)|0);
   HEAP32[$133>>2] = $130;
   return;
  }
  $134 = $114 & -8;
  $135 = (($134) + ($psize$1))|0;
  $136 = $114 >>> 3;
  $137 = ($114>>>0)<(256);
  do {
   if ($137) {
    $138 = ((($9)) + 8|0);
    $139 = HEAP32[$138>>2]|0;
    $140 = ((($9)) + 12|0);
    $141 = HEAP32[$140>>2]|0;
    $142 = $136 << 1;
    $143 = (9072 + ($142<<2)|0);
    $144 = ($139|0)==($143|0);
    if (!($144)) {
     $145 = HEAP32[(9048)>>2]|0;
     $146 = ($139>>>0)<($145>>>0);
     if ($146) {
      _abort();
      // unreachable;
     }
     $147 = ((($139)) + 12|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = ($148|0)==($9|0);
     if (!($149)) {
      _abort();
      // unreachable;
     }
    }
    $150 = ($141|0)==($139|0);
    if ($150) {
     $151 = 1 << $136;
     $152 = $151 ^ -1;
     $153 = HEAP32[2258]|0;
     $154 = $153 & $152;
     HEAP32[2258] = $154;
     break;
    }
    $155 = ($141|0)==($143|0);
    if ($155) {
     $$pre40 = ((($141)) + 8|0);
     $$pre$phi41Z2D = $$pre40;
    } else {
     $156 = HEAP32[(9048)>>2]|0;
     $157 = ($141>>>0)<($156>>>0);
     if ($157) {
      _abort();
      // unreachable;
     }
     $158 = ((($141)) + 8|0);
     $159 = HEAP32[$158>>2]|0;
     $160 = ($159|0)==($9|0);
     if ($160) {
      $$pre$phi41Z2D = $158;
     } else {
      _abort();
      // unreachable;
     }
    }
    $161 = ((($139)) + 12|0);
    HEAP32[$161>>2] = $141;
    HEAP32[$$pre$phi41Z2D>>2] = $139;
   } else {
    $162 = ((($9)) + 24|0);
    $163 = HEAP32[$162>>2]|0;
    $164 = ((($9)) + 12|0);
    $165 = HEAP32[$164>>2]|0;
    $166 = ($165|0)==($9|0);
    do {
     if ($166) {
      $177 = ((($9)) + 16|0);
      $178 = ((($177)) + 4|0);
      $179 = HEAP32[$178>>2]|0;
      $180 = ($179|0)==(0|0);
      if ($180) {
       $181 = HEAP32[$177>>2]|0;
       $182 = ($181|0)==(0|0);
       if ($182) {
        $R8$3 = 0;
        break;
       } else {
        $R8$1 = $181;$RP10$1 = $177;
       }
      } else {
       $R8$1 = $179;$RP10$1 = $178;
      }
      while(1) {
       $183 = ((($R8$1)) + 20|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = ($184|0)==(0|0);
       if (!($185)) {
        $R8$1 = $184;$RP10$1 = $183;
        continue;
       }
       $186 = ((($R8$1)) + 16|0);
       $187 = HEAP32[$186>>2]|0;
       $188 = ($187|0)==(0|0);
       if ($188) {
        $R8$1$lcssa = $R8$1;$RP10$1$lcssa = $RP10$1;
        break;
       } else {
        $R8$1 = $187;$RP10$1 = $186;
       }
      }
      $189 = HEAP32[(9048)>>2]|0;
      $190 = ($RP10$1$lcssa>>>0)<($189>>>0);
      if ($190) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$RP10$1$lcssa>>2] = 0;
       $R8$3 = $R8$1$lcssa;
       break;
      }
     } else {
      $167 = ((($9)) + 8|0);
      $168 = HEAP32[$167>>2]|0;
      $169 = HEAP32[(9048)>>2]|0;
      $170 = ($168>>>0)<($169>>>0);
      if ($170) {
       _abort();
       // unreachable;
      }
      $171 = ((($168)) + 12|0);
      $172 = HEAP32[$171>>2]|0;
      $173 = ($172|0)==($9|0);
      if (!($173)) {
       _abort();
       // unreachable;
      }
      $174 = ((($165)) + 8|0);
      $175 = HEAP32[$174>>2]|0;
      $176 = ($175|0)==($9|0);
      if ($176) {
       HEAP32[$171>>2] = $165;
       HEAP32[$174>>2] = $168;
       $R8$3 = $165;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $191 = ($163|0)==(0|0);
    if (!($191)) {
     $192 = ((($9)) + 28|0);
     $193 = HEAP32[$192>>2]|0;
     $194 = (9336 + ($193<<2)|0);
     $195 = HEAP32[$194>>2]|0;
     $196 = ($9|0)==($195|0);
     if ($196) {
      HEAP32[$194>>2] = $R8$3;
      $cond21 = ($R8$3|0)==(0|0);
      if ($cond21) {
       $197 = 1 << $193;
       $198 = $197 ^ -1;
       $199 = HEAP32[(9036)>>2]|0;
       $200 = $199 & $198;
       HEAP32[(9036)>>2] = $200;
       break;
      }
     } else {
      $201 = HEAP32[(9048)>>2]|0;
      $202 = ($163>>>0)<($201>>>0);
      if ($202) {
       _abort();
       // unreachable;
      }
      $203 = ((($163)) + 16|0);
      $204 = HEAP32[$203>>2]|0;
      $205 = ($204|0)==($9|0);
      if ($205) {
       HEAP32[$203>>2] = $R8$3;
      } else {
       $206 = ((($163)) + 20|0);
       HEAP32[$206>>2] = $R8$3;
      }
      $207 = ($R8$3|0)==(0|0);
      if ($207) {
       break;
      }
     }
     $208 = HEAP32[(9048)>>2]|0;
     $209 = ($R8$3>>>0)<($208>>>0);
     if ($209) {
      _abort();
      // unreachable;
     }
     $210 = ((($R8$3)) + 24|0);
     HEAP32[$210>>2] = $163;
     $211 = ((($9)) + 16|0);
     $212 = HEAP32[$211>>2]|0;
     $213 = ($212|0)==(0|0);
     do {
      if (!($213)) {
       $214 = ($212>>>0)<($208>>>0);
       if ($214) {
        _abort();
        // unreachable;
       } else {
        $215 = ((($R8$3)) + 16|0);
        HEAP32[$215>>2] = $212;
        $216 = ((($212)) + 24|0);
        HEAP32[$216>>2] = $R8$3;
        break;
       }
      }
     } while(0);
     $217 = ((($211)) + 4|0);
     $218 = HEAP32[$217>>2]|0;
     $219 = ($218|0)==(0|0);
     if (!($219)) {
      $220 = HEAP32[(9048)>>2]|0;
      $221 = ($218>>>0)<($220>>>0);
      if ($221) {
       _abort();
       // unreachable;
      } else {
       $222 = ((($R8$3)) + 20|0);
       HEAP32[$222>>2] = $218;
       $223 = ((($218)) + 24|0);
       HEAP32[$223>>2] = $R8$3;
       break;
      }
     }
    }
   }
  } while(0);
  $224 = $135 | 1;
  $225 = ((($p$1)) + 4|0);
  HEAP32[$225>>2] = $224;
  $226 = (($p$1) + ($135)|0);
  HEAP32[$226>>2] = $135;
  $227 = HEAP32[(9052)>>2]|0;
  $228 = ($p$1|0)==($227|0);
  if ($228) {
   HEAP32[(9040)>>2] = $135;
   return;
  } else {
   $psize$2 = $135;
  }
 } else {
  $229 = $114 & -2;
  HEAP32[$113>>2] = $229;
  $230 = $psize$1 | 1;
  $231 = ((($p$1)) + 4|0);
  HEAP32[$231>>2] = $230;
  $232 = (($p$1) + ($psize$1)|0);
  HEAP32[$232>>2] = $psize$1;
  $psize$2 = $psize$1;
 }
 $233 = $psize$2 >>> 3;
 $234 = ($psize$2>>>0)<(256);
 if ($234) {
  $235 = $233 << 1;
  $236 = (9072 + ($235<<2)|0);
  $237 = HEAP32[2258]|0;
  $238 = 1 << $233;
  $239 = $237 & $238;
  $240 = ($239|0)==(0);
  if ($240) {
   $241 = $237 | $238;
   HEAP32[2258] = $241;
   $$pre = ((($236)) + 8|0);
   $$pre$phiZ2D = $$pre;$F18$0 = $236;
  } else {
   $242 = ((($236)) + 8|0);
   $243 = HEAP32[$242>>2]|0;
   $244 = HEAP32[(9048)>>2]|0;
   $245 = ($243>>>0)<($244>>>0);
   if ($245) {
    _abort();
    // unreachable;
   } else {
    $$pre$phiZ2D = $242;$F18$0 = $243;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $p$1;
  $246 = ((($F18$0)) + 12|0);
  HEAP32[$246>>2] = $p$1;
  $247 = ((($p$1)) + 8|0);
  HEAP32[$247>>2] = $F18$0;
  $248 = ((($p$1)) + 12|0);
  HEAP32[$248>>2] = $236;
  return;
 }
 $249 = $psize$2 >>> 8;
 $250 = ($249|0)==(0);
 if ($250) {
  $I20$0 = 0;
 } else {
  $251 = ($psize$2>>>0)>(16777215);
  if ($251) {
   $I20$0 = 31;
  } else {
   $252 = (($249) + 1048320)|0;
   $253 = $252 >>> 16;
   $254 = $253 & 8;
   $255 = $249 << $254;
   $256 = (($255) + 520192)|0;
   $257 = $256 >>> 16;
   $258 = $257 & 4;
   $259 = $258 | $254;
   $260 = $255 << $258;
   $261 = (($260) + 245760)|0;
   $262 = $261 >>> 16;
   $263 = $262 & 2;
   $264 = $259 | $263;
   $265 = (14 - ($264))|0;
   $266 = $260 << $263;
   $267 = $266 >>> 15;
   $268 = (($265) + ($267))|0;
   $269 = $268 << 1;
   $270 = (($268) + 7)|0;
   $271 = $psize$2 >>> $270;
   $272 = $271 & 1;
   $273 = $272 | $269;
   $I20$0 = $273;
  }
 }
 $274 = (9336 + ($I20$0<<2)|0);
 $275 = ((($p$1)) + 28|0);
 HEAP32[$275>>2] = $I20$0;
 $276 = ((($p$1)) + 16|0);
 $277 = ((($p$1)) + 20|0);
 HEAP32[$277>>2] = 0;
 HEAP32[$276>>2] = 0;
 $278 = HEAP32[(9036)>>2]|0;
 $279 = 1 << $I20$0;
 $280 = $278 & $279;
 $281 = ($280|0)==(0);
 do {
  if ($281) {
   $282 = $278 | $279;
   HEAP32[(9036)>>2] = $282;
   HEAP32[$274>>2] = $p$1;
   $283 = ((($p$1)) + 24|0);
   HEAP32[$283>>2] = $274;
   $284 = ((($p$1)) + 12|0);
   HEAP32[$284>>2] = $p$1;
   $285 = ((($p$1)) + 8|0);
   HEAP32[$285>>2] = $p$1;
  } else {
   $286 = HEAP32[$274>>2]|0;
   $287 = ($I20$0|0)==(31);
   $288 = $I20$0 >>> 1;
   $289 = (25 - ($288))|0;
   $290 = $287 ? 0 : $289;
   $291 = $psize$2 << $290;
   $K21$0 = $291;$T$0 = $286;
   while(1) {
    $292 = ((($T$0)) + 4|0);
    $293 = HEAP32[$292>>2]|0;
    $294 = $293 & -8;
    $295 = ($294|0)==($psize$2|0);
    if ($295) {
     $T$0$lcssa = $T$0;
     label = 130;
     break;
    }
    $296 = $K21$0 >>> 31;
    $297 = (((($T$0)) + 16|0) + ($296<<2)|0);
    $298 = $K21$0 << 1;
    $299 = HEAP32[$297>>2]|0;
    $300 = ($299|0)==(0|0);
    if ($300) {
     $$lcssa = $297;$T$0$lcssa48 = $T$0;
     label = 127;
     break;
    } else {
     $K21$0 = $298;$T$0 = $299;
    }
   }
   if ((label|0) == 127) {
    $301 = HEAP32[(9048)>>2]|0;
    $302 = ($$lcssa>>>0)<($301>>>0);
    if ($302) {
     _abort();
     // unreachable;
    } else {
     HEAP32[$$lcssa>>2] = $p$1;
     $303 = ((($p$1)) + 24|0);
     HEAP32[$303>>2] = $T$0$lcssa48;
     $304 = ((($p$1)) + 12|0);
     HEAP32[$304>>2] = $p$1;
     $305 = ((($p$1)) + 8|0);
     HEAP32[$305>>2] = $p$1;
     break;
    }
   }
   else if ((label|0) == 130) {
    $306 = ((($T$0$lcssa)) + 8|0);
    $307 = HEAP32[$306>>2]|0;
    $308 = HEAP32[(9048)>>2]|0;
    $309 = ($307>>>0)>=($308>>>0);
    $not$ = ($T$0$lcssa>>>0)>=($308>>>0);
    $310 = $309 & $not$;
    if ($310) {
     $311 = ((($307)) + 12|0);
     HEAP32[$311>>2] = $p$1;
     HEAP32[$306>>2] = $p$1;
     $312 = ((($p$1)) + 8|0);
     HEAP32[$312>>2] = $307;
     $313 = ((($p$1)) + 12|0);
     HEAP32[$313>>2] = $T$0$lcssa;
     $314 = ((($p$1)) + 24|0);
     HEAP32[$314>>2] = 0;
     break;
    } else {
     _abort();
     // unreachable;
    }
   }
  }
 } while(0);
 $315 = HEAP32[(9064)>>2]|0;
 $316 = (($315) + -1)|0;
 HEAP32[(9064)>>2] = $316;
 $317 = ($316|0)==(0);
 if ($317) {
  $sp$0$in$i = (9488);
 } else {
  return;
 }
 while(1) {
  $sp$0$i = HEAP32[$sp$0$in$i>>2]|0;
  $318 = ($sp$0$i|0)==(0|0);
  $319 = ((($sp$0$i)) + 8|0);
  if ($318) {
   break;
  } else {
   $sp$0$in$i = $319;
  }
 }
 HEAP32[(9064)>>2] = -1;
 return;
}
function _calloc($n_elements,$elem_size) {
 $n_elements = $n_elements|0;
 $elem_size = $elem_size|0;
 var $$ = 0, $0 = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $req$0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = ($n_elements|0)==(0);
 if ($0) {
  $req$0 = 0;
 } else {
  $1 = Math_imul($elem_size, $n_elements)|0;
  $2 = $elem_size | $n_elements;
  $3 = ($2>>>0)>(65535);
  if ($3) {
   $4 = (($1>>>0) / ($n_elements>>>0))&-1;
   $5 = ($4|0)==($elem_size|0);
   $$ = $5 ? $1 : -1;
   $req$0 = $$;
  } else {
   $req$0 = $1;
  }
 }
 $6 = (_malloc($req$0)|0);
 $7 = ($6|0)==(0|0);
 if ($7) {
  return ($6|0);
 }
 $8 = ((($6)) + -4|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = $9 & 3;
 $11 = ($10|0)==(0);
 if ($11) {
  return ($6|0);
 }
 _memset(($6|0),0,($req$0|0))|0;
 return ($6|0);
}
function runPostSets() {
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _bitshift64Ashr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = (high|0) < 0 ? -1 : 0;
    return (high >> (bits - 32))|0;
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var stop = 0, value4 = 0, stop4 = 0, unaligned = 0;
    stop = (ptr + num)|0;
    if ((num|0) >= 20) {
      // This is unaligned, but quite large, so work hard to get to aligned settings
      value = value & 0xff;
      unaligned = ptr & 3;
      value4 = value | (value << 8) | (value << 16) | (value << 24);
      stop4 = stop & ~3;
      if (unaligned) {
        unaligned = (ptr + 4 - unaligned)|0;
        while ((ptr|0) < (unaligned|0)) { // no need to check for stop, since we have large num
          HEAP8[((ptr)>>0)]=value;
          ptr = (ptr+1)|0;
        }
      }
      while ((ptr|0) < (stop4|0)) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    while ((ptr|0) < (stop|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (ptr-num)|0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    if ((num|0) >= 4096) return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    ret = dest|0;
    if ((dest&3) == (src&3)) {
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      while ((num|0) >= 4) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
        num = (num-4)|0;
      }
    }
    while ((num|0) > 0) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
      num = (num-1)|0;
    }
    return ret|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
  }
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
  }
function _llvm_cttz_i32(x) {
    x = x|0;
    var ret = 0;
    ret = ((HEAP8[(((cttz_i8)+(x & 0xff))>>0)])|0);
    if ((ret|0) < 8) return ret|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 8)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 8)|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 16)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 16)|0;
    return (((HEAP8[(((cttz_i8)+(x >>> 24))>>0)])|0) + 24)|0;
  }

// ======== compiled code from system/lib/compiler-rt , see readme therein
function ___muldsi3($a, $b) {
  $a = $a | 0;
  $b = $b | 0;
  var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
  $1 = $a & 65535;
  $2 = $b & 65535;
  $3 = Math_imul($2, $1) | 0;
  $6 = $a >>> 16;
  $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
  $11 = $b >>> 16;
  $12 = Math_imul($11, $1) | 0;
  return (tempRet0 = (($8 >>> 16) + (Math_imul($11, $6) | 0) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, 0 | ($8 + $12 << 16 | $3 & 65535)) | 0;
}
function ___divdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $1$0 = 0, $1$1 = 0, $2$0 = 0, $2$1 = 0, $4$0 = 0, $4$1 = 0, $6$0 = 0, $7$0 = 0, $7$1 = 0, $8$0 = 0, $10$0 = 0;
  $1$0 = $a$1 >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $1$1 = (($a$1 | 0) < 0 ? -1 : 0) >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $2$0 = $b$1 >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $2$1 = (($b$1 | 0) < 0 ? -1 : 0) >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $4$0 = _i64Subtract($1$0 ^ $a$0 | 0, $1$1 ^ $a$1 | 0, $1$0 | 0, $1$1 | 0) | 0;
  $4$1 = tempRet0;
  $6$0 = _i64Subtract($2$0 ^ $b$0 | 0, $2$1 ^ $b$1 | 0, $2$0 | 0, $2$1 | 0) | 0;
  $7$0 = $2$0 ^ $1$0;
  $7$1 = $2$1 ^ $1$1;
  $8$0 = ___udivmoddi4($4$0, $4$1, $6$0, tempRet0, 0) | 0;
  $10$0 = _i64Subtract($8$0 ^ $7$0 | 0, tempRet0 ^ $7$1 | 0, $7$0 | 0, $7$1 | 0) | 0;
  return $10$0 | 0;
}
function ___remdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $rem = 0, $1$0 = 0, $1$1 = 0, $2$0 = 0, $2$1 = 0, $4$0 = 0, $4$1 = 0, $6$0 = 0, $10$0 = 0, $10$1 = 0, __stackBase__ = 0;
  __stackBase__ = STACKTOP;
  STACKTOP = STACKTOP + 16 | 0;
  $rem = __stackBase__ | 0;
  $1$0 = $a$1 >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $1$1 = (($a$1 | 0) < 0 ? -1 : 0) >> 31 | (($a$1 | 0) < 0 ? -1 : 0) << 1;
  $2$0 = $b$1 >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $2$1 = (($b$1 | 0) < 0 ? -1 : 0) >> 31 | (($b$1 | 0) < 0 ? -1 : 0) << 1;
  $4$0 = _i64Subtract($1$0 ^ $a$0 | 0, $1$1 ^ $a$1 | 0, $1$0 | 0, $1$1 | 0) | 0;
  $4$1 = tempRet0;
  $6$0 = _i64Subtract($2$0 ^ $b$0 | 0, $2$1 ^ $b$1 | 0, $2$0 | 0, $2$1 | 0) | 0;
  ___udivmoddi4($4$0, $4$1, $6$0, tempRet0, $rem) | 0;
  $10$0 = _i64Subtract(HEAP32[$rem >> 2] ^ $1$0 | 0, HEAP32[$rem + 4 >> 2] ^ $1$1 | 0, $1$0 | 0, $1$1 | 0) | 0;
  $10$1 = tempRet0;
  STACKTOP = __stackBase__;
  return (tempRet0 = $10$1, $10$0) | 0;
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0, $2 = 0;
  $x_sroa_0_0_extract_trunc = $a$0;
  $y_sroa_0_0_extract_trunc = $b$0;
  $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
  $1$1 = tempRet0;
  $2 = Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0;
  return (tempRet0 = ((Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $2 | 0) + $1$1 | $1$1 & 0, 0 | $1$0 & -1) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $1$0 = 0;
  $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
  return $1$0 | 0;
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  var $rem = 0, __stackBase__ = 0;
  __stackBase__ = STACKTOP;
  STACKTOP = STACKTOP + 16 | 0;
  $rem = __stackBase__ | 0;
  ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
  STACKTOP = __stackBase__;
  return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
  $a$0 = $a$0 | 0;
  $a$1 = $a$1 | 0;
  $b$0 = $b$0 | 0;
  $b$1 = $b$1 | 0;
  $rem = $rem | 0;
  var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
  $n_sroa_0_0_extract_trunc = $a$0;
  $n_sroa_1_4_extract_shift$0 = $a$1;
  $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
  $d_sroa_0_0_extract_trunc = $b$0;
  $d_sroa_1_4_extract_shift$0 = $b$1;
  $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
  if (($n_sroa_1_4_extract_trunc | 0) == 0) {
    $4 = ($rem | 0) != 0;
    if (($d_sroa_1_4_extract_trunc | 0) == 0) {
      if ($4) {
        HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
        HEAP32[$rem + 4 >> 2] = 0;
      }
      $_0$1 = 0;
      $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    } else {
      if (!$4) {
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      HEAP32[$rem >> 2] = $a$0 & -1;
      HEAP32[$rem + 4 >> 2] = $a$1 & 0;
      $_0$1 = 0;
      $_0$0 = 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    }
  }
  $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
  do {
    if (($d_sroa_0_0_extract_trunc | 0) == 0) {
      if ($17) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      if (($n_sroa_0_0_extract_trunc | 0) == 0) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = 0;
          HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
      if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
        }
        $_0$1 = 0;
        $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
      $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
      if ($51 >>> 0 <= 30) {
        $57 = $51 + 1 | 0;
        $58 = 31 - $51 | 0;
        $sr_1_ph = $57;
        $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
        $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
        $q_sroa_0_1_ph = 0;
        $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
        break;
      }
      if (($rem | 0) == 0) {
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      HEAP32[$rem >> 2] = 0 | $a$0 & -1;
      HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
      $_0$1 = 0;
      $_0$0 = 0;
      return (tempRet0 = $_0$1, $_0$0) | 0;
    } else {
      if (!$17) {
        $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($119 >>> 0 <= 31) {
          $125 = $119 + 1 | 0;
          $126 = 31 - $119 | 0;
          $130 = $119 - 31 >> 31;
          $sr_1_ph = $125;
          $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
      $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
      if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
        $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
        $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        $89 = 64 - $88 | 0;
        $91 = 32 - $88 | 0;
        $92 = $91 >> 31;
        $95 = $88 - 32 | 0;
        $105 = $95 >> 31;
        $sr_1_ph = $88;
        $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
        $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
        $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
        $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
        break;
      }
      if (($rem | 0) != 0) {
        HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
        HEAP32[$rem + 4 >> 2] = 0;
      }
      if (($d_sroa_0_0_extract_trunc | 0) == 1) {
        $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$0 = 0 | $a$0 & -1;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
        $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
        $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
  } while (0);
  if (($sr_1_ph | 0) == 0) {
    $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
    $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
    $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
    $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
    $carry_0_lcssa$1 = 0;
    $carry_0_lcssa$0 = 0;
  } else {
    $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
    $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
    $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
    $137$1 = tempRet0;
    $q_sroa_1_1198 = $q_sroa_1_1_ph;
    $q_sroa_0_1199 = $q_sroa_0_1_ph;
    $r_sroa_1_1200 = $r_sroa_1_1_ph;
    $r_sroa_0_1201 = $r_sroa_0_1_ph;
    $sr_1202 = $sr_1_ph;
    $carry_0203 = 0;
    while (1) {
      $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
      $149 = $carry_0203 | $q_sroa_0_1199 << 1;
      $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
      $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
      _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
      $150$1 = tempRet0;
      $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
      $152 = $151$0 & 1;
      $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
      $r_sroa_0_0_extract_trunc = $154$0;
      $r_sroa_1_4_extract_trunc = tempRet0;
      $155 = $sr_1202 - 1 | 0;
      if (($155 | 0) == 0) {
        break;
      } else {
        $q_sroa_1_1198 = $147;
        $q_sroa_0_1199 = $149;
        $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
        $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
        $sr_1202 = $155;
        $carry_0203 = $152;
      }
    }
    $q_sroa_1_1_lcssa = $147;
    $q_sroa_0_1_lcssa = $149;
    $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
    $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
    $carry_0_lcssa$1 = 0;
    $carry_0_lcssa$0 = $152;
  }
  $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
  $q_sroa_0_0_insert_ext75$1 = 0;
  $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
  if (($rem | 0) != 0) {
    HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
    HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
  }
  $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
  $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
  return (tempRet0 = $_0$1, $_0$0) | 0;
}
// =======================================================================



  
function dynCall_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return FUNCTION_TABLE_iiiiiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}


function jsCall_iiiiiiii_0(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(0,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_1(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(1,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_2(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(2,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_3(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(3,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_4(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(4,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_5(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(5,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_6(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(6,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function jsCall_iiiiiiii_7(a1,a2,a3,a4,a5,a6,a7) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0;
  return jsCall_iiiiiiii(7,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0)|0;
}



function dynCall_iiiiii(index,a1,a2,a3,a4,a5) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return FUNCTION_TABLE_iiiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}


function jsCall_iiiiii_0(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(0,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_1(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(1,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_2(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(2,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_3(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(3,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_4(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(4,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_5(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(5,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_6(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(6,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function jsCall_iiiiii_7(a1,a2,a3,a4,a5) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return jsCall_iiiiii(7,a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}



function dynCall_iiiiiii(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return FUNCTION_TABLE_iiiiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}


function jsCall_iiiiiii_0(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(0,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_1(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(1,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_2(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(2,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_3(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(3,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_4(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(4,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_5(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(5,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_6(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(6,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function jsCall_iiiiiii_7(a1,a2,a3,a4,a5,a6) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  return jsCall_iiiiiii(7,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0)|0;
}



function dynCall_iiiii(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return FUNCTION_TABLE_iiiii[index&31](a1|0,a2|0,a3|0,a4|0)|0;
}


function jsCall_iiiii_0(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(0,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_1(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(1,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_2(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(2,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_3(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(3,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_4(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(4,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_5(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(5,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_6(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(6,a1|0,a2|0,a3|0,a4|0)|0;
}



function jsCall_iiiii_7(a1,a2,a3,a4) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return jsCall_iiiii(7,a1|0,a2|0,a3|0,a4|0)|0;
}



function dynCall_iiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return FUNCTION_TABLE_iiiiiiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}


function jsCall_iiiiiiiii_0(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(0,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_1(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(1,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_2(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(2,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_3(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(3,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_4(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(4,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_5(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(5,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_6(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(6,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function jsCall_iiiiiiiii_7(a1,a2,a3,a4,a5,a6,a7,a8) {
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0; a7=a7|0; a8=a8|0;
  return jsCall_iiiiiiiii(7,a1|0,a2|0,a3|0,a4|0,a5|0,a6|0,a7|0,a8|0)|0;
}



function dynCall_iii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  return FUNCTION_TABLE_iii[index&31](a1|0,a2|0)|0;
}


function jsCall_iii_0(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(0,a1|0,a2|0)|0;
}



function jsCall_iii_1(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(1,a1|0,a2|0)|0;
}



function jsCall_iii_2(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(2,a1|0,a2|0)|0;
}



function jsCall_iii_3(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(3,a1|0,a2|0)|0;
}



function jsCall_iii_4(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(4,a1|0,a2|0)|0;
}



function jsCall_iii_5(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(5,a1|0,a2|0)|0;
}



function jsCall_iii_6(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(6,a1|0,a2|0)|0;
}



function jsCall_iii_7(a1,a2) {
  a1=a1|0; a2=a2|0;
  return jsCall_iii(7,a1|0,a2|0)|0;
}


function b1(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(0);return 0;
}
function b2(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(9);return 0;
}
function b3(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(10);return 0;
}
function b4(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(11);return 0;
}
function b5(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(12);return 0;
}
function b6(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(13);return 0;
}
function b7(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(14);return 0;
}
function b8(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(15);return 0;
}
function b9(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(16);return 0;
}
function b10(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(17);return 0;
}
function b11(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(19);return 0;
}
function b12(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(20);return 0;
}
function b13(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(21);return 0;
}
function b14(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(22);return 0;
}
function b15(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(23);return 0;
}
function b16(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(24);return 0;
}
function b17(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(25);return 0;
}
function b18(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(26);return 0;
}
function b19(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(27);return 0;
}
function b20(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(28);return 0;
}
function b21(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(29);return 0;
}
function b22(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(30);return 0;
}
function b23(p0,p1,p2,p3,p4,p5,p6) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0; nullFunc_iiiiiiii(31);return 0;
}
function b25(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(0);return 0;
}
function b26(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(9);return 0;
}
function b27(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(10);return 0;
}
function b28(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(11);return 0;
}
function b29(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(12);return 0;
}
function b30(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(13);return 0;
}
function b31(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(14);return 0;
}
function b32(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(15);return 0;
}
function b33(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(16);return 0;
}
function b34(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(17);return 0;
}
function b35(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(20);return 0;
}
function b36(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(21);return 0;
}
function b37(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(22);return 0;
}
function b38(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(23);return 0;
}
function b39(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(24);return 0;
}
function b40(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(25);return 0;
}
function b41(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(26);return 0;
}
function b42(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(27);return 0;
}
function b43(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(28);return 0;
}
function b44(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(29);return 0;
}
function b45(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(30);return 0;
}
function b46(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_iiiiii(31);return 0;
}
function b48(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(0);return 0;
}
function b49(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(9);return 0;
}
function b50(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(10);return 0;
}
function b51(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(11);return 0;
}
function b52(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(12);return 0;
}
function b53(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(13);return 0;
}
function b54(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(14);return 0;
}
function b55(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(15);return 0;
}
function b56(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(16);return 0;
}
function b57(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(17);return 0;
}
function b58(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(19);return 0;
}
function b59(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(20);return 0;
}
function b60(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(21);return 0;
}
function b61(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(22);return 0;
}
function b62(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(23);return 0;
}
function b63(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(24);return 0;
}
function b64(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(25);return 0;
}
function b65(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(26);return 0;
}
function b66(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(27);return 0;
}
function b67(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(28);return 0;
}
function b68(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(29);return 0;
}
function b69(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(30);return 0;
}
function b70(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_iiiiiii(31);return 0;
}
function b72(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(0);return 0;
}
function b73(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(9);return 0;
}
function b74(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(10);return 0;
}
function b75(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(11);return 0;
}
function b76(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(12);return 0;
}
function b77(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(13);return 0;
}
function b78(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(14);return 0;
}
function b79(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(15);return 0;
}
function b80(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(16);return 0;
}
function b81(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(17);return 0;
}
function b82(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(19);return 0;
}
function b83(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(20);return 0;
}
function b84(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(21);return 0;
}
function b85(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(22);return 0;
}
function b86(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(23);return 0;
}
function b87(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(24);return 0;
}
function b88(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(25);return 0;
}
function b89(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(26);return 0;
}
function b90(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(27);return 0;
}
function b91(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(28);return 0;
}
function b92(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(29);return 0;
}
function b93(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(30);return 0;
}
function b94(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_iiiii(31);return 0;
}
function b96(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(0);return 0;
}
function b97(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(9);return 0;
}
function b98(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(10);return 0;
}
function b99(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(11);return 0;
}
function b100(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(12);return 0;
}
function b101(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(13);return 0;
}
function b102(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(14);return 0;
}
function b103(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(15);return 0;
}
function b104(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(16);return 0;
}
function b105(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(17);return 0;
}
function b106(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(19);return 0;
}
function b107(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(20);return 0;
}
function b108(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(21);return 0;
}
function b109(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(22);return 0;
}
function b110(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(23);return 0;
}
function b111(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(24);return 0;
}
function b112(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(25);return 0;
}
function b113(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(26);return 0;
}
function b114(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(27);return 0;
}
function b115(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(28);return 0;
}
function b116(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(29);return 0;
}
function b117(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(30);return 0;
}
function b118(p0,p1,p2,p3,p4,p5,p6,p7) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0;p6 = p6|0;p7 = p7|0; nullFunc_iiiiiiiii(31);return 0;
}
function b120(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(0);return 0;
}
function b121(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(9);return 0;
}
function b122(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(10);return 0;
}
function b123(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(11);return 0;
}
function b124(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(12);return 0;
}
function b125(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(13);return 0;
}
function b126(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(14);return 0;
}
function b127(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(15);return 0;
}
function b128(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(16);return 0;
}
function b129(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(17);return 0;
}
function b130(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(19);return 0;
}
function b131(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(20);return 0;
}
function b132(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(21);return 0;
}
function b133(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(22);return 0;
}
function b134(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(23);return 0;
}
function b135(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(24);return 0;
}
function b136(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(25);return 0;
}
function b137(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(26);return 0;
}
function b138(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(27);return 0;
}
function b139(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(28);return 0;
}
function b140(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(29);return 0;
}
function b141(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(30);return 0;
}
function b142(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(31);return 0;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_iiiiiiii = [b1,jsCall_iiiiiiii_0,jsCall_iiiiiiii_1,jsCall_iiiiiiii_2,jsCall_iiiiiiii_3,jsCall_iiiiiiii_4,jsCall_iiiiiiii_5,jsCall_iiiiiiii_6,jsCall_iiiiiiii_7,b2,b3,b4,b5,b6,b7,b8,b9,b10,_stream_ietf_ref_xor_ic,b11,b12,b13,b14,b15,b16,b17,b18,b19,b20
,b21,b22,b23];
var FUNCTION_TABLE_iiiiii = [b25,jsCall_iiiiii_0,jsCall_iiiiii_1,jsCall_iiiiii_2,jsCall_iiiiii_3,jsCall_iiiiii_4,jsCall_iiiiii_5,jsCall_iiiiii_6,jsCall_iiiiii_7,b26,b27,b28,b29,b30,b31,b32,b33,b34,_stream_ref,_stream_ietf_ref,b35,b36,b37,b38,b39,b40,b41,b42,b43
,b44,b45,b46];
var FUNCTION_TABLE_iiiiiii = [b48,jsCall_iiiiiii_0,jsCall_iiiiiii_1,jsCall_iiiiiii_2,jsCall_iiiiiii_3,jsCall_iiiiiii_4,jsCall_iiiiiii_5,jsCall_iiiiiii_6,jsCall_iiiiiii_7,b49,b50,b51,b52,b53,b54,b55,b56,b57,_rlwejs_streamoutput,b58,b59,b60,b61,b62,b63,b64,b65,b66,b67
,b68,b69,b70];
var FUNCTION_TABLE_iiiii = [b72,jsCall_iiiii_0,jsCall_iiiii_1,jsCall_iiiii_2,jsCall_iiiii_3,jsCall_iiiii_4,jsCall_iiiii_5,jsCall_iiiii_6,jsCall_iiiii_7,b73,b74,b75,b76,b77,b78,b79,b80,b81,_rlwejs_extendableoutput,b82,b83,b84,b85,b86,b87,b88,b89,b90,b91
,b92,b93,b94];
var FUNCTION_TABLE_iiiiiiiii = [b96,jsCall_iiiiiiiii_0,jsCall_iiiiiiiii_1,jsCall_iiiiiiiii_2,jsCall_iiiiiiiii_3,jsCall_iiiiiiiii_4,jsCall_iiiiiiiii_5,jsCall_iiiiiiiii_6,jsCall_iiiiiiiii_7,b97,b98,b99,b100,b101,b102,b103,b104,b105,_stream_ref_xor_ic,b106,b107,b108,b109,b110,b111,b112,b113,b114,b115
,b116,b117,b118];
var FUNCTION_TABLE_iii = [b120,jsCall_iii_0,jsCall_iii_1,jsCall_iii_2,jsCall_iii_3,jsCall_iii_4,jsCall_iii_5,jsCall_iii_6,jsCall_iii_7,b121,b122,b123,b124,b125,b126,b127,b128,b129,_rlwejs_randombytes,b130,b131,b132,b133,b134,b135,b136,b137,b138,b139
,b140,b141,b142];

  return { _memset: _memset, _rlwejs_secret_alice: _rlwejs_secret_alice, _free: _free, _rlwejs_private_key_bytes: _rlwejs_private_key_bytes, _i64Add: _i64Add, _bitshift64Ashr: _bitshift64Ashr, _i64Subtract: _i64Subtract, _rlwejs_secret_bytes: _rlwejs_secret_bytes, _malloc: _malloc, _rlwejs_keypair_alice: _rlwejs_keypair_alice, _memcpy: _memcpy, _rlwejs_init: _rlwejs_init, _rlwejs_public_key_bytes: _rlwejs_public_key_bytes, _rlwejs_secret_bob: _rlwejs_secret_bob, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_iiiiiiii: dynCall_iiiiiiii, dynCall_iiiiii: dynCall_iiiiii, dynCall_iiiiiii: dynCall_iiiiiii, dynCall_iiiii: dynCall_iiiii, dynCall_iiiiiiiii: dynCall_iiiiiiiii, dynCall_iii: dynCall_iii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var real__rlwejs_secret_alice = asm["_rlwejs_secret_alice"]; asm["_rlwejs_secret_alice"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_secret_alice.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__free.apply(null, arguments);
};

var real__rlwejs_private_key_bytes = asm["_rlwejs_private_key_bytes"]; asm["_rlwejs_private_key_bytes"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_private_key_bytes.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Add.apply(null, arguments);
};

var real__bitshift64Ashr = asm["_bitshift64Ashr"]; asm["_bitshift64Ashr"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__bitshift64Ashr.apply(null, arguments);
};

var real__rlwejs_secret_bytes = asm["_rlwejs_secret_bytes"]; asm["_rlwejs_secret_bytes"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_secret_bytes.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__malloc.apply(null, arguments);
};

var real__rlwejs_public_key_bytes = asm["_rlwejs_public_key_bytes"]; asm["_rlwejs_public_key_bytes"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_public_key_bytes.apply(null, arguments);
};

var real__rlwejs_init = asm["_rlwejs_init"]; asm["_rlwejs_init"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_init.apply(null, arguments);
};

var real__rlwejs_keypair_alice = asm["_rlwejs_keypair_alice"]; asm["_rlwejs_keypair_alice"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_keypair_alice.apply(null, arguments);
};

var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__i64Subtract.apply(null, arguments);
};

var real__rlwejs_secret_bob = asm["_rlwejs_secret_bob"]; asm["_rlwejs_secret_bob"] = function() {
assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
return real__rlwejs_secret_bob.apply(null, arguments);
};
var _rlwejs_secret_alice = Module["_rlwejs_secret_alice"] = asm["_rlwejs_secret_alice"];
var _free = Module["_free"] = asm["_free"];
var _rlwejs_private_key_bytes = Module["_rlwejs_private_key_bytes"] = asm["_rlwejs_private_key_bytes"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _bitshift64Ashr = Module["_bitshift64Ashr"] = asm["_bitshift64Ashr"];
var _memset = Module["_memset"] = asm["_memset"];
var _rlwejs_secret_bytes = Module["_rlwejs_secret_bytes"] = asm["_rlwejs_secret_bytes"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _rlwejs_public_key_bytes = Module["_rlwejs_public_key_bytes"] = asm["_rlwejs_public_key_bytes"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _rlwejs_init = Module["_rlwejs_init"] = asm["_rlwejs_init"];
var _rlwejs_keypair_alice = Module["_rlwejs_keypair_alice"] = asm["_rlwejs_keypair_alice"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _rlwejs_secret_bob = Module["_rlwejs_secret_bob"] = asm["_rlwejs_secret_bob"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = asm["dynCall_iiiiiiii"];
var dynCall_iiiiii = Module["dynCall_iiiiii"] = asm["dynCall_iiiiii"];
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = asm["dynCall_iiiiiii"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = asm["dynCall_iiiiiiiii"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
;

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.establishStackSpace = asm['establishStackSpace'];

Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===




function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    Module.printErr('run() called, but dependencies remain, so not running');
    return;
  }

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return; 

    ensureInitRuntime();

    preMain();

    if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
      Module.printErr('pre-main prep time: ' + (Date.now() - preloadStartTime) + ' ms');
    }

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') implicitly called by end of main(), but noExitRuntime, so not exiting the runtime (you can use emscripten_force_exit, if you want to force a true shutdown)');
    return;
  }

  if (Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') called, but noExitRuntime, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)');
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  } else if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}






// {{MODULE_ADDITIONS}}


// EMSCRIPTEN_GENERATED_FUNCTIONS: ["_i64Subtract","_i64Add","_bitshift64Ashr","_memset","_memcpy","_bitshift64Shl","_bitshift64Lshr","_llvm_cttz_i32"]


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
//# sourceMappingURL=rlwe.debug.js.map