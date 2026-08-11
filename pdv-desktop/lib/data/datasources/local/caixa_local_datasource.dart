import 'package:isar/isar.dart';
import '../../models/caixa_session_model.dart';

abstract class CaixaLocalDataSource {
  Future<void> save(CaixaSessionModel session);
  Future<CaixaSessionModel?> current();
}

class CaixaLocalDataSourceImpl implements CaixaLocalDataSource {
  final Isar isar;
  const CaixaLocalDataSourceImpl(this.isar);

  @override
  Future<void> save(CaixaSessionModel session) async {
    await isar.writeTxn(() async {
      // Só existe um turno ativo por vez — substitui o anterior.
      await isar.caixaSessionModels.clear();
      await isar.caixaSessionModels.put(session);
    });
  }

  @override
  Future<CaixaSessionModel?> current() {
    return isar.caixaSessionModels.where().findFirst();
  }
}
