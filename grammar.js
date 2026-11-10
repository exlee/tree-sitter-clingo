/// <reference types="tree-sitter-cli/dsl" />
// Tree-sitter grammar for clingo (Answer Set Programming, gringo/clasp input language).

const PREC = {
  interval: 1,
  or: 2,
  xor: 3,
  and: 4,
  additive: 5,
  multiplicative: 6,
  power: 7,
  unary: 8,
};

const sep1 = (rule, separator) => seq(rule, repeat(seq(separator, rule)));

module.exports = grammar({
  name: 'clingo',

  extras: $ => [/\s/, $.comment, $.block_comment],

  word: $ => $.identifier,

  conflicts: $ => [
    [$.aggregate],
    [$.constant, $.signature],
  ],

  rules: {
    source_file: $ => repeat($._statement),

    _statement: $ => choice(
      $.rule,
      $.weak_constraint,
      $.show_directive,
      $.const_directive,
      $.include_directive,
      $.program_directive,
      $.external_directive,
      $.optimize_directive,
      $.heuristic_directive,
      $.edge_directive,
      $.project_directive,
      $.defined_directive,
      $.theory_definition,
      $.script_block,
    ),

    // ---- comments -------------------------------------------------------
    comment: _ => token(seq('%', /[^\r\n]*/)),

    // %* ... *%  (block comments do not nest in clingo)
    block_comment: _ => token(seq('%*', /[^*]*\*+([^%*][^*]*\*+)*/, '%')),

    // ---- rules ----------------------------------------------------------
    rule: $ => choice(
      // fact / head-only rule
      seq(field('head', $.head), '.'),
      // rule with body (head optional: integrity constraint)
      seq(optional(field('head', $.head)), ':-', optional(field('body', $.body)), '.'),
    ),

    weak_constraint: $ => seq(
      ':~',
      optional(field('body', $.body)),
      '.',
      $.weak_annotation,
    ),

    weak_annotation: $ => seq(
      '[',
      field('weight', $._term),
      optional(seq('@', field('priority', $._term))),
      repeat(seq(',', $._term)),
      ']',
    ),

    head: $ => sep1($._head_element, choice('|', ';')),

    _head_element: $ => choice(
      $.conditional_literal,
      $.aggregate,
      $.theory_atom,
      $._literal,
    ),

    body: $ => sep1($._body_element, choice(',', ';')),

    _body_element: $ => choice(
      $.conditional_literal,
      $.aggregate,
      $.theory_atom,
      $._literal,
    ),

    // a : b, c
    conditional_literal: $ => seq(
      $._literal,
      ':',
      field('condition', $.condition),
    ),

    condition: $ => prec.right(sep1($._literal, ',')),

    // ---- literals -------------------------------------------------------
    _literal: $ => choice(
      $.comparison,
      $.boolean_constant,
      $.literal,
    ),

    boolean_constant: $ => seq(repeat($.negation), choice('#true', '#false')),

    negation: _ => 'not',

    literal: $ => seq(repeat($.negation), $._term),

    comparison: $ => seq(
      repeat($.negation),
      $._term,
      repeat1(seq($.comparison_operator, $._term)),
    ),

    comparison_operator: _ => choice('=', '!=', '<', '<=', '>', '>='),

    // ---- aggregates -----------------------------------------------------
    aggregate: $ => choice(
      // count/sum/min/max
      seq(
        repeat($.negation),
        optional(seq(field('left', $._term), optional($.comparison_operator))),
        $.aggregate_function,
        '{',
        optional(sep1($.aggregate_element, ';')),
        '}',
        optional(seq(optional($.comparison_operator), field('right', $._term))),
      ),
      // choice rule / set aggregate: 1 { a; b } 2
      seq(
        repeat($.negation),
        optional(seq(field('left', $._term), optional($.comparison_operator))),
        '{',
        optional(sep1($.set_aggregate_element, ';')),
        '}',
        optional(seq(optional($.comparison_operator), field('right', $._term))),
      ),
    ),

    aggregate_function: _ => choice('#count', '#sum+', '#sum', '#min', '#max'),

    // t1, t2 : lit, lit
    aggregate_element: $ => choice(
      seq(sep1($._term, ','), optional(seq(':', field('condition', $.condition)))),
      seq(':', field('condition', $.condition)),
    ),

    // lit : lit, lit
    set_aggregate_element: $ => seq(
      $._literal,
      optional(seq(':', field('condition', $.condition))),
    ),

    // ---- terms ----------------------------------------------------------
    _term: $ => choice(
      $.variable,
      $.anonymous_variable,
      $.number,
      $.string,
      $.constant,
      $.supremum,
      $.infimum,
      $.function,
      $.external_function,
      $.tuple,
      $.unary_expression,
      $.binary_expression,
      $.interval,
      $.absolute_value,
    ),

    variable: _ => /_*[A-Z][A-Za-z0-9_']*/,
    anonymous_variable: _ => '_',
    number: _ => token(choice(/[0-9]+/, /0x[0-9a-fA-F]+/, /0o[0-7]+/, /0b[01]+/)),
    string: $ => seq(
      '"',
      repeat(choice($.escape_sequence, $.string_content)),
      '"',
    ),
    string_content: _ => token.immediate(prec(1, /[^"\\\n]+/)),
    escape_sequence: _ => token.immediate(/\\./),
    supremum: _ => choice('#sup', '#supremum'),
    infimum: _ => choice('#inf', '#infimum'),

    // identifier is the lexical `word`; a bare identifier is a constant
    constant: $ => $.identifier,
    identifier: _ => /_*[a-z][A-Za-z0-9_']*/,

    function: $ => seq(
      field('name', $.identifier),
      '(',
      optional($.arguments),
      ')',
    ),

    external_function: $ => seq(
      '@',
      field('name', $.identifier),
      optional(seq('(', optional($.arguments), ')')),
    ),

    arguments: $ => sep1($._term, choice(',', ';')),

    tuple: $ => seq(
      '(',
      optional(choice(
        seq($._term, ','),
        seq($._term, repeat1(seq(choice(',', ';'), $._term)), optional(',')),
        $._term,
      )),
      ')',
    ),

    unary_expression: $ => prec(PREC.unary, seq(
      field('operator', choice('-', '~')),
      field('argument', $._term),
    )),

    absolute_value: $ => seq('|', sep1($._term, ';'), '|'),

    binary_expression: $ => choice(
      ...[
        ['?', PREC.or],
        ['^', PREC.xor],
        ['&', PREC.and],
        ['+', PREC.additive],
        ['-', PREC.additive],
        ['*', PREC.multiplicative],
        ['/', PREC.multiplicative],
        ['\\', PREC.multiplicative],
      ].map(([op, p]) => prec.left(p, seq(
        field('left', $._term), field('operator', op), field('right', $._term)))),
      prec.right(PREC.power, seq(
        field('left', $._term), field('operator', '**'), field('right', $._term))),
    ),

    interval: $ => prec.left(PREC.interval, seq(
      field('low', $._term), '..', field('high', $._term))),

    // ---- directives -----------------------------------------------------
    show_directive: $ => choice(
      seq('#show', '.'),
      // #show p/N.   #show -p/N.
      seq('#show', field('signature', $.signature), '.'),
      // #show term : body.
      seq('#show', field('term', $._term), ':', optional(field('body', $.body)), '.'),
    ),

    signature: $ => seq(
      optional('-'), field('name', $.identifier), '/', field('arity', $.number),
    ),

    const_directive: $ => seq(
      '#const',
      field('name', $.identifier),
      '=',
      field('value', $._term),
      '.',
      optional($.const_mode),
    ),

    const_mode: $ => seq('[', choice('default', 'override'), ']'),

    include_directive: $ => seq(
      '#include',
      choice($.string, seq('<', $.identifier, '>')),
      '.',
    ),

    program_directive: $ => seq(
      '#program',
      field('name', $.identifier),
      optional(seq('(', optional(sep1(choice($.identifier, $.variable), ',')), ')')),
      '.',
    ),

    external_directive: $ => seq(
      '#external',
      field('atom', $._term),
      optional(seq(':', optional(field('body', $.body)))),
      '.',
      optional(seq('[', field('value', $._term), ']')),
    ),

    optimize_directive: $ => seq(
      choice('#minimize', '#minimise', '#maximize', '#maximise'),
      '{',
      optional(sep1($.optimize_element, ';')),
      '}',
      '.',
    ),

    // w@p, t : cond
    optimize_element: $ => seq(
      field('weight', $._term),
      optional(seq('@', field('priority', $._term))),
      repeat(seq(',', $._term)),
      optional(seq(':', field('condition', $.condition))),
    ),

    heuristic_directive: $ => seq(
      '#heuristic',
      field('atom', $._term),
      optional(seq(':', optional(field('body', $.body)))),
      '.',
      '[',
      field('value', $._term),
      optional(seq('@', field('priority', $._term))),
      ',',
      field('modifier', $._term),
      ']',
    ),

    edge_directive: $ => seq(
      '#edge',
      '(',
      $._term, ',', $._term,
      repeat(seq(';', $._term, ',', $._term)),
      ')',
      optional(seq(':', optional(field('body', $.body)))),
      '.',
    ),

    project_directive: $ => choice(
      seq('#project', field('signature', $.signature), '.'),
      seq('#project', field('atom', $._term), optional(seq(':', optional(field('body', $.body)))), '.'),
    ),

    defined_directive: $ => seq('#defined', $.signature, '.'),

    // #script (python) ... #end.
    script_block: $ => seq(
      '#script',
      '(',
      field('language', $.identifier),
      ')',
      optional(field('code', $.script_code)),
      '#end',
      '.',
    ),

    script_code: _ => token(prec(-1, /([^#]|#[^e]|#e[^n]|#en[^d])+/)),

    // ---- theory atoms ---------------------------------------------------
    theory_atom: $ => seq(
      '&',
      field('name', $._term),
      optional(seq('{', optional(sep1($.theory_element, ';')), '}')),
      optional(seq(field('operator', $.theory_operator), field('guard', $._theory_term))),
    ),

    theory_element: $ => seq(
      sep1($._theory_term, ','),
      optional(seq(':', field('condition', $.condition))),
    ),

    theory_operator: _ => token(/[/!<=>+\-*?&@|:.%^\\~]+/),

    _theory_term: $ => choice(
      $._term,
      prec.left(seq($._theory_term, $.theory_operator, $._theory_term)),
    ),

    // #theory name { term_def; &atom_def }.
    theory_definition: $ => seq(
      '#theory',
      field('name', $.identifier),
      '{',
      optional(sep1($.theory_definition_entry, ';')),
      '}',
      '.',
    ),

    theory_definition_entry: $ => choice(
      $.theory_term_definition,
      $.theory_atom_definition,
    ),

    // sum_term { + : 1, binary, left; - : 1, unary }
    theory_term_definition: $ => seq(
      field('name', $.identifier),
      '{',
      optional(sep1($.theory_operator_definition, ';')),
      '}',
    ),

    // + : 1, binary, left
    theory_operator_definition: $ => seq(
      $.theory_operator, ':', $.number, ',', $.identifier, optional(seq(',', $.identifier)),
    ),

    // &diff/0 : sum_term, {<=}, bound, any
    theory_atom_definition: $ => seq(
      '&', field('name', $.identifier), '/', $.number, ':',
      field('elements', $.identifier), ',',
      optional(seq('{', sep1($.theory_operator, ','), '}', ',', $.identifier, ',')),
      $.identifier,
    ),
  },
});
