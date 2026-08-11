import 'package:equatable/equatable.dart';

class UserSessionEntity extends Equatable {
  final String userId;
  final String storeId;
  final String storeName;
  final String storeSlug;
  final String name;
  final String email;
  final String role;

  /// null quando a sessão foi resolvida OFFLINE — sem token não dá pra
  /// sincronizar ainda (precisa de um login online pra renovar).
  final String? token;

  const UserSessionEntity({
    required this.userId,
    required this.storeId,
    required this.storeName,
    required this.storeSlug,
    required this.name,
    required this.email,
    required this.role,
    this.token,
  });

  bool get isOnlineSession => token != null;

  @override
  List<Object?> get props => [userId, storeId, token];
}
