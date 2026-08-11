import 'package:isar/isar.dart';
import '../../models/category_model.dart';

abstract class CategoryLocalDataSource {
  Future<void> upsertAll(List<CategoryModel> categories);
  Stream<List<CategoryModel>> watchByStore(String storeId);
}

class CategoryLocalDataSourceImpl implements CategoryLocalDataSource {
  final Isar isar;
  const CategoryLocalDataSourceImpl(this.isar);

  @override
  Future<void> upsertAll(List<CategoryModel> categories) async {
    await isar.writeTxn(() async {
      await isar.categoryModels.putAll(categories);
    });
  }

  @override
  Stream<List<CategoryModel>> watchByStore(String storeId) {
    return isar.categoryModels
        .filter()
        .storeIdEqualTo(storeId)
        .activeEqualTo(true)
        .sortByPosition()
        .build()
        .watch(fireImmediately: true);
  }
}
