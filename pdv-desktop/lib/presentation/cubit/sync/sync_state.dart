import 'package:equatable/equatable.dart';

class SyncState extends Equatable {
  final int pendingCount;
  final bool syncing;

  const SyncState({this.pendingCount = 0, this.syncing = false});

  SyncState copyWith({int? pendingCount, bool? syncing}) => SyncState(
        pendingCount: pendingCount ?? this.pendingCount,
        syncing: syncing ?? this.syncing,
      );

  @override
  List<Object?> get props => [pendingCount, syncing];
}
