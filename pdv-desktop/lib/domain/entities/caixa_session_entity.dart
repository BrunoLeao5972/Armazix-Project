import 'package:equatable/equatable.dart';

/// Sessão de caixa (turno) — a API só sabe abrir/fechar caixa online (cria a
/// linha em caixaSessoes na hora). Guardamos a última sessão aberta
/// localmente pra permitir continuar vendendo offline dentro do mesmo turno;
/// só o PRIMEIRO turno de cada computador exige estar online uma vez.
class CaixaSessionEntity extends Equatable {
  final String remoteId;
  final String saldoInicial;
  final DateTime openedAt;

  const CaixaSessionEntity({
    required this.remoteId,
    required this.saldoInicial,
    required this.openedAt,
  });

  @override
  List<Object?> get props => [remoteId];
}
