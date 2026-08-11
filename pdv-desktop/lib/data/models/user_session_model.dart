import 'package:isar/isar.dart';
import '../../domain/entities/user_session_entity.dart';

part 'user_session_model.g.dart';

@collection
class UserSessionModel {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: true)
  late String userId;

  @Index(unique: true, replace: true)
  late String email;

  late String storeId;
  late String storeName;
  late String storeSlug;
  late String name;
  late String role;

  /// JWT do último login ONLINE — permite retomar a sessão sem digitar senha
  /// de novo enquanto o token não expira (7 dias, mesma janela do painel web).
  ///
  /// SECURITY: fica em texto puro no arquivo do Isar (sem servidor de
  /// criptografia externo, como pedido). Isso assume o mesmo modelo de
  /// confiança de qualquer PDV físico: quem tem acesso à máquina do caixa já
  /// tem acesso ao caixa. Não reaproveitar esse token fora deste app.
  String? token;

  /// Verificador de senha LOCAL (PBKDF2) — nunca o hash do servidor, que o
  /// cliente nunca chega a ver. Usado só pra validar login OFFLINE.
  late String userHash;
  late String passwordSalt;
  int passwordIterations = 100000;

  DateTime? lastOnlineLoginAt;

  UserSessionEntity toEntity({bool asOnline = false}) => UserSessionEntity(
        userId: userId,
        storeId: storeId,
        storeName: storeName,
        storeSlug: storeSlug,
        name: name,
        email: email,
        role: role,
        token: asOnline ? token : null,
      );
}
