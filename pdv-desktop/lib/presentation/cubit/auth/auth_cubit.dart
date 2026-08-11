import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../domain/usecases/login_usecase.dart';
import '../../../domain/usecases/logout_usecase.dart';
import '../../../domain/usecases/sync_catalog_usecase.dart';
import 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  final LoginUseCase loginUseCase;
  final LogoutUseCase logoutUseCase;
  final SyncCatalogUseCase syncCatalogUseCase;

  AuthCubit({
    required this.loginUseCase,
    required this.logoutUseCase,
    required this.syncCatalogUseCase,
  }) : super(const AuthInitial());

  Future<void> login(String email, String password) async {
    emit(const AuthLoading());
    final result = await loginUseCase(email: email, password: password);
    result.fold(
      (failure) => emit(AuthError(failure.message)),
      (session) {
        emit(AuthAuthenticated(session));
        if (session.isOnlineSession) {
          // Falha aqui não bloqueia o operador — o caixa abre com o que já
          // estiver em cache de sessões/sincronizações anteriores.
          syncCatalogUseCase(session.storeId);
        }
      },
    );
  }

  Future<void> logout() async {
    await logoutUseCase();
    emit(const AuthInitial());
  }
}
