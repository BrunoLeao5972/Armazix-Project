import 'package:equatable/equatable.dart';

class CategoryEntity extends Equatable {
  final String remoteId;
  final String storeId;
  final String name;
  final String? emoji;
  final String? icon;
  final int position;
  final bool active;

  const CategoryEntity({
    required this.remoteId,
    required this.storeId,
    required this.name,
    this.emoji,
    this.icon,
    this.position = 0,
    this.active = true,
  });

  @override
  List<Object?> get props => [remoteId, name, position];
}
