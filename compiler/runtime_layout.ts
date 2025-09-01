export const TAG_TUPLE = 0;
export const TAG_CLOSURE = 1;

export const HEAP_BASE = 0x100; // bump pointer starts here

// Closure memory layout (i32 words):
// [ size | tag=1 | code_index | env_len | env0 | env1 | ... ]

// Tuple memory layout:
// [ size | tag=0 | f0 | f1 | ... ]
