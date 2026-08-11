import 'package:isar/isar.dart';
import '../../domain/entities/caixa_session_entity.dart';

part 'caixa_session_model.g.dart';

/// Não fazia parte do pedido original de 4 collections, mas é infraestrutura
/// necessária: finalizar-venda no backend exige um sessaoId de caixa aberto
/// (ver /api/pdv/caixa/abrir). Guardamos a última sessão aberta pra permitir
/// reabrir o turno offline sem re-consultar o servidor.
@collection
class CaixaSessionModel {
  Id id = Isar.autoIncrement;

  late String remoteId;
  late String saldoInicial;
  late DateTime openedAt;

  CaixaSessionEntity toEntity() => CaixaSessionEntity(
        remoteId: remoteId,
        saldoInicial: saldoInicial,
        openedAt: openedAt,
      );
}
