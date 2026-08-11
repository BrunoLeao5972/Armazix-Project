import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../domain/repositories/caixa_repository.dart';
import '../../../domain/usecases/open_register_usecase.dart';
import 'register_state.dart';

class RegisterCubit extends Cubit<RegisterState> {
  final OpenRegisterUseCase openRegisterUseCase;

  RegisterCubit({required this.openRegisterUseCase, required CaixaRepository caixaRepository})
      : super(RegisterState(session: caixaRepository.cachedSession));

  Future<void> open(String saldoInicial, {String? abertoPor}) async {
    emit(state.copyWith(loading: true, error: null));
    final result = await openRegisterUseCase(saldoInicial: saldoInicial, abertoPor: abertoPor);
    result.fold(
      (failure) => emit(state.copyWith(loading: false, error: failure.message)),
      (session) => emit(state.copyWith(loading: false, session: session, error: null)),
    );
  }
}
