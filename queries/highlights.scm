[(comment) (block_comment)] @comment

(string) @string
(escape_sequence) @string.escape
(number) @number

(variable) @variable
(anonymous_variable) @variable.builtin

(supremum) @constant.builtin
(infimum) @constant.builtin
(boolean_constant) @constant.builtin

(function name: (identifier) @function)
(external_function "@" @operator name: (identifier) @function.builtin)
(constant (identifier) @constant)

(negation) @keyword.operator
(aggregate_function) @function.builtin
(comparison_operator) @operator
(theory_operator) @operator

(signature name: (identifier) @function)
(const_directive name: (identifier) @constant)
(program_directive name: (identifier) @namespace)
(theory_definition name: (identifier) @type)
(theory_term_definition name: (identifier) @type)
(theory_atom_definition name: (identifier) @function)
(theory_atom name: (_) @function.macro)
(script_block language: (identifier) @attribute)
(script_code) @embedded

[
  "#show" "#const" "#include" "#program" "#external" "#minimize" "#minimise"
  "#maximize" "#maximise" "#heuristic" "#edge" "#project" "#defined"
  "#script" "#end" "#theory"
] @keyword

(binary_expression operator: _ @operator)
(unary_expression operator: _ @operator)
(interval ".." @operator)

[":-" ":~" "|"] @keyword.operator
["(" ")" "{" "}" "[" "]"] @punctuation.bracket
["," ";" "." ":"] @punctuation.delimiter
