import 'package:equatable/equatable.dart';
import '../../../domain/entities/user_session_entity.dart';

sealed class AuthState extends Equatable {
  const AuthState();
  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  final UserSessionEntity session;
  const AuthAuthenticated(this.session);
  @override
  List<Object?> get props => [session];
}

class AuthError extends AuthState {
  final String message;
  const AuthError(this.message);
  @override
  List<Object?> get props => [message];
}
