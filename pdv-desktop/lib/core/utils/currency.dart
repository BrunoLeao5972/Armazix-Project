import 'package:intl/intl.dart';

/// Preço trafega e é armazenado como string decimal ("12.90"), nunca double
/// puro — mesma convenção do backend Armazix, evita erro de arredondamento
/// em dinheiro. Só vira double no último passo, pra formatar.
class Currency {
  Currency._();

  static final _formatter = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');

  static double parse(String value) => double.tryParse(value) ?? 0;

  static String format(num value) => _formatter.format(value);

  static String formatFromString(String value) => format(parse(value));

  static String toApiString(double value) => value.toStringAsFixed(2);
}
