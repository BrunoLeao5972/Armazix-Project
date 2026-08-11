import 'package:equatable/equatable.dart';
import '../../../domain/entities/caixa_session_entity.dart';

class RegisterState extends Equatable {
  final CaixaSessionEntity? session;
  final bool loading;
  final String? error;

  const RegisterState({this.session, this.loading = false, this.error});

  RegisterState copyWith({CaixaSessionEntity? session, bool? loading, String? error}) => RegisterState(
        session: session ?? this.session,
        loading: loading ?? this.loading,
        error: error,
      );

  @override
  List<Object?> get props => [session, loading, error];
}
