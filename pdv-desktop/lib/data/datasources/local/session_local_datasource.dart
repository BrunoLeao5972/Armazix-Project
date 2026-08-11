import 'package:isar/isar.dart';
import '../../models/user_session_model.dart';

abstract class SessionLocalDataSource {
  Future<void> save(UserSessionModel session);
  Future<UserSessionModel?> findByEmail(String email);
}

class SessionLocalDataSourceImpl implements SessionLocalDataSource {
  final Isar isar;
  const SessionLocalDataSourceImpl(this.isar);

  @override
  Future<void> save(UserSessionModel session) async {
    await isar.writeTxn(() async {
      await isar.userSessionModels.put(session);
    });
  }

  @override
  Future<UserSessionModel?> findByEmail(String email) {
    return isar.userSessionModels.filter().emailEqualTo(email).findFirst();
  }
}
