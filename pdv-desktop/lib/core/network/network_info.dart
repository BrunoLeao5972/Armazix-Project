import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../constants/api_constants.dart';

/// Sensoriamento de conectividade — combina o evento nativo do SO (rápido,
/// mas só sabe se HÁ uma interface de rede) com um ping periódico de saúde
/// na API (mais lento, mas prova que o Armazix Cloud está alcançável de
/// verdade — a rede pode estar "conectada" com o servidor fora do ar mesmo
/// assim).
abstract class NetworkInfo {
  ValueListenable<bool> get isOnline;
  Future<void> checkNow();
  void dispose();
}

class NetworkInfoImpl implements NetworkInfo {
  final Connectivity _connectivity;
  final Dio _pingDio;
  final _isOnlineNotifier = ValueNotifier<bool>(false);
  StreamSubscription<List<ConnectivityResult>>? _sub;
  Timer? _timer;

  NetworkInfoImpl(this._connectivity)
      : _pingDio = Dio(BaseOptions(
          baseUrl: ApiConstants.baseUrl,
          connectTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
        )) {
    _sub = _connectivity.onConnectivityChanged.listen((_) => checkNow());
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => checkNow());
    checkNow();
  }

  @override
  ValueListenable<bool> get isOnline => _isOnlineNotifier;

  @override
  Future<void> checkNow() async {
    final results = await _connectivity.checkConnectivity();
    final hasInterface = !results.contains(ConnectivityResult.none);
    if (!hasInterface) {
      _isOnlineNotifier.value = false;
      return;
    }
    try {
      final res = await _pingDio.get(ApiConstants.health);
      _isOnlineNotifier.value = res.statusCode == 200;
    } catch (_) {
      _isOnlineNotifier.value = false;
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    _timer?.cancel();
    _isOnlineNotifier.dispose();
  }
}
