import 'package:isar/isar.dart';
import '../../domain/entities/category_entity.dart';

part 'category_model.g.dart';

@collection
class CategoryModel {
  Id id = Isar.autoIncrement;

  @Index(unique: true, replace: true)
  late String remoteId;

  @Index()
  late String storeId;

  String? parentId;
  late String name;
  String? emoji;
  String? icon;
  String? color;
  String? imageUrl;
  int position = 0;
  bool active = true;

  CategoryEntity toEntity() => CategoryEntity(
        remoteId: remoteId,
        storeId: storeId,
        name: name,
        emoji: emoji,
        icon: icon,
        position: position,
        active: active,
      );
}
