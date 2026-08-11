import 'dart:convert';
import 'dart:math';
import 'package:cryptography/cryptography.dart';

/// Verificador de senha LOCAL, pra login offline.
///
/// O servidor nunca entrega o hash bcrypt do usuário (nem deveria) — então
/// "salvar o hash pra login offline" só pode significar um hash que o
/// PRÓPRIO app calcula, no momento em que a senha já foi validada online
/// pela API. Da próxima vez sem internet, refaz o mesmo cálculo em cima do
/// que foi digitado e compara com o que ficou salvo (UserSessionModel.userHash).
class LocalPasswordHasher {
  static const int _iterations = 100000;
  static const int _saltBytes = 16;

  static final _pbkdf2 = Pbkdf2(
    macAlgorithm: Hmac.sha256(),
    iterations: _iterations,
    bits: 256,
  );

  /// Chamado logo após um login ONLINE bem-sucedido.
  static Future<({String hash, String salt, int iterations})> hash(String password) async {
    final salt = _randomSalt();
    final secretKey = await _pbkdf2.deriveKeyFromPassword(password: password, nonce: salt);
    final bytes = await secretKey.extractBytes();
    return (hash: base64Encode(bytes), salt: base64Encode(salt), iterations: _iterations);
  }

  /// Chamado num login OFFLINE, contra o verificador salvo no login online anterior.
  static Future<bool> verify(
    String password, {
    required String storedHash,
    required String storedSalt,
    required int iterations,
  }) async {
    final pbkdf2 = iterations == _iterations
        ? _pbkdf2
        : Pbkdf2(macAlgorithm: Hmac.sha256(), iterations: iterations, bits: 256);
    final salt = base64Decode(storedSalt);
    final secretKey = await pbkdf2.deriveKeyFromPassword(password: password, nonce: salt);
    final bytes = await secretKey.extractBytes();
    final computedHash = base64Encode(bytes);
    return _timingSafeEqual(computedHash, storedHash);
  }

  static List<int> _randomSalt() {
    final random = Random.secure();
    return List<int>.generate(_saltBytes, (_) => random.nextInt(256));
  }

  static bool _timingSafeEqual(String a, String b) {
    if (a.length != b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return diff == 0;
  }
}
