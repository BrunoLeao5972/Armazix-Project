import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/network/network_info.dart';

/// Espelha o `ValueListenable<bool>` do NetworkInfo como Cubit, pra widgets
/// consumirem via BlocBuilder junto do resto do estado da tela.
class ConnectivityCubit extends Cubit<bool> {
  final NetworkInfo networkInfo;
  late final VoidCallback _listener;

  ConnectivityCubit(this.networkInfo) : super(networkInfo.isOnline.value) {
    _listener = () => emit(networkInfo.isOnline.value);
    networkInfo.isOnline.addListener(_listener);
  }

  @override
  Future<void> close() {
    networkInfo.isOnline.removeListener(_listener);
    return super.close();
  }
}
