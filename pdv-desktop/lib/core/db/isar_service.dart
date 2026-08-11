import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';
import '../../data/models/caixa_session_model.dart';
import '../../data/models/category_model.dart';
import '../../data/models/order_model.dart';
import '../../data/models/product_model.dart';
import '../../data/models/user_session_model.dart';

/// Abre o banco Isar uma única vez, na pasta de dados do app (persistida
/// pelo Windows entre execuções — nada de servidor externo).
class IsarService {
  IsarService._();

  static Future<Isar> open() async {
    final dir = await getApplicationSupportDirectory();
    return Isar.open(
      [
        ProductModelSchema,
        CategoryModelSchema,
        OrderModelSchema,
        UserSessionModelSchema,
        CaixaSessionModelSchema,
      ],
      directory: dir.path,
      name: 'armazix_pdv',
    );
  }
}
