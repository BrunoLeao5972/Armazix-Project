// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_model.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetOrderModelCollection on Isar {
  IsarCollection<OrderModel> get orderModels => this.collection();
}

const OrderModelSchema = CollectionSchema(
  name: r'OrderModel',
  id: 3315151259962091397,
  properties: {
    r'createdAt': PropertySchema(
      id: 0,
      name: r'createdAt',
      type: IsarType.dateTime,
    ),
    r'discount': PropertySchema(
      id: 1,
      name: r'discount',
      type: IsarType.string,
    ),
    r'installments': PropertySchema(
      id: 2,
      name: r'installments',
      type: IsarType.long,
    ),
    r'isSynced': PropertySchema(
      id: 3,
      name: r'isSynced',
      type: IsarType.bool,
    ),
    r'items': PropertySchema(
      id: 4,
      name: r'items',
      type: IsarType.objectList,
      target: r'OrderItemEmbedded',
    ),
    r'localCode': PropertySchema(
      id: 5,
      name: r'localCode',
      type: IsarType.string,
    ),
    r'mesaLabel': PropertySchema(
      id: 6,
      name: r'mesaLabel',
      type: IsarType.string,
    ),
    r'paymentMethod': PropertySchema(
      id: 7,
      name: r'paymentMethod',
      type: IsarType.string,
    ),
    r'remoteNumber': PropertySchema(
      id: 8,
      name: r'remoteNumber',
      type: IsarType.long,
    ),
    r'remoteOrderId': PropertySchema(
      id: 9,
      name: r'remoteOrderId',
      type: IsarType.string,
    ),
    r'sessaoId': PropertySchema(
      id: 10,
      name: r'sessaoId',
      type: IsarType.string,
    ),
    r'storeId': PropertySchema(
      id: 11,
      name: r'storeId',
      type: IsarType.string,
    ),
    r'subtotal': PropertySchema(
      id: 12,
      name: r'subtotal',
      type: IsarType.string,
    ),
    r'syncAttempts': PropertySchema(
      id: 13,
      name: r'syncAttempts',
      type: IsarType.long,
    ),
    r'syncError': PropertySchema(
      id: 14,
      name: r'syncError',
      type: IsarType.string,
    ),
    r'total': PropertySchema(
      id: 15,
      name: r'total',
      type: IsarType.string,
    )
  },
  estimateSize: _orderModelEstimateSize,
  serialize: _orderModelSerialize,
  deserialize: _orderModelDeserialize,
  deserializeProp: _orderModelDeserializeProp,
  idName: r'id',
  indexes: {
    r'localCode': IndexSchema(
      id: -3178841227557033066,
      name: r'localCode',
      unique: true,
      replace: true,
      properties: [
        IndexPropertySchema(
          name: r'localCode',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'storeId': IndexSchema(
      id: 2730892149058446507,
      name: r'storeId',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'storeId',
          type: IndexType.hash,
          caseSensitive: true,
        )
      ],
    ),
    r'isSynced': IndexSchema(
      id: -39763503327887510,
      name: r'isSynced',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'isSynced',
          type: IndexType.value,
          caseSensitive: false,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {r'OrderItemEmbedded': OrderItemEmbeddedSchema},
  getId: _orderModelGetId,
  getLinks: _orderModelGetLinks,
  attach: _orderModelAttach,
  version: '3.1.0+1',
);

int _orderModelEstimateSize(
  OrderModel object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  {
    final value = object.discount;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.items.length * 3;
  {
    final offsets = allOffsets[OrderItemEmbedded]!;
    for (var i = 0; i < object.items.length; i++) {
      final value = object.items[i];
      bytesCount +=
          OrderItemEmbeddedSchema.estimateSize(value, offsets, allOffsets);
    }
  }
  bytesCount += 3 + object.localCode.length * 3;
  {
    final value = object.mesaLabel;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.paymentMethod.length * 3;
  {
    final value = object.remoteOrderId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.sessaoId.length * 3;
  bytesCount += 3 + object.storeId.length * 3;
  bytesCount += 3 + object.subtotal.length * 3;
  {
    final value = object.syncError;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.total.length * 3;
  return bytesCount;
}

void _orderModelSerialize(
  OrderModel object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeDateTime(offsets[0], object.createdAt);
  writer.writeString(offsets[1], object.discount);
  writer.writeLong(offsets[2], object.installments);
  writer.writeBool(offsets[3], object.isSynced);
  writer.writeObjectList<OrderItemEmbedded>(
    offsets[4],
    allOffsets,
    OrderItemEmbeddedSchema.serialize,
    object.items,
  );
  writer.writeString(offsets[5], object.localCode);
  writer.writeString(offsets[6], object.mesaLabel);
  writer.writeString(offsets[7], object.paymentMethod);
  writer.writeLong(offsets[8], object.remoteNumber);
  writer.writeString(offsets[9], object.remoteOrderId);
  writer.writeString(offsets[10], object.sessaoId);
  writer.writeString(offsets[11], object.storeId);
  writer.writeString(offsets[12], object.subtotal);
  writer.writeLong(offsets[13], object.syncAttempts);
  writer.writeString(offsets[14], object.syncError);
  writer.writeString(offsets[15], object.total);
}

OrderModel _orderModelDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = OrderModel();
  object.createdAt = reader.readDateTime(offsets[0]);
  object.discount = reader.readStringOrNull(offsets[1]);
  object.id = id;
  object.installments = reader.readLongOrNull(offsets[2]);
  object.isSynced = reader.readBool(offsets[3]);
  object.items = reader.readObjectList<OrderItemEmbedded>(
        offsets[4],
        OrderItemEmbeddedSchema.deserialize,
        allOffsets,
        OrderItemEmbedded(),
      ) ??
      [];
  object.localCode = reader.readString(offsets[5]);
  object.mesaLabel = reader.readStringOrNull(offsets[6]);
  object.paymentMethod = reader.readString(offsets[7]);
  object.remoteNumber = reader.readLongOrNull(offsets[8]);
  object.remoteOrderId = reader.readStringOrNull(offsets[9]);
  object.sessaoId = reader.readString(offsets[10]);
  object.storeId = reader.readString(offsets[11]);
  object.subtotal = reader.readString(offsets[12]);
  object.syncAttempts = reader.readLong(offsets[13]);
  object.syncError = reader.readStringOrNull(offsets[14]);
  object.total = reader.readString(offsets[15]);
  return object;
}

P _orderModelDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readDateTime(offset)) as P;
    case 1:
      return (reader.readStringOrNull(offset)) as P;
    case 2:
      return (reader.readLongOrNull(offset)) as P;
    case 3:
      return (reader.readBool(offset)) as P;
    case 4:
      return (reader.readObjectList<OrderItemEmbedded>(
            offset,
            OrderItemEmbeddedSchema.deserialize,
            allOffsets,
            OrderItemEmbedded(),
          ) ??
          []) as P;
    case 5:
      return (reader.readString(offset)) as P;
    case 6:
      return (reader.readStringOrNull(offset)) as P;
    case 7:
      return (reader.readString(offset)) as P;
    case 8:
      return (reader.readLongOrNull(offset)) as P;
    case 9:
      return (reader.readStringOrNull(offset)) as P;
    case 10:
      return (reader.readString(offset)) as P;
    case 11:
      return (reader.readString(offset)) as P;
    case 12:
      return (reader.readString(offset)) as P;
    case 13:
      return (reader.readLong(offset)) as P;
    case 14:
      return (reader.readStringOrNull(offset)) as P;
    case 15:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _orderModelGetId(OrderModel object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _orderModelGetLinks(OrderModel object) {
  return [];
}

void _orderModelAttach(IsarCollection<dynamic> col, Id id, OrderModel object) {
  object.id = id;
}

extension OrderModelByIndex on IsarCollection<OrderModel> {
  Future<OrderModel?> getByLocalCode(String localCode) {
    return getByIndex(r'localCode', [localCode]);
  }

  OrderModel? getByLocalCodeSync(String localCode) {
    return getByIndexSync(r'localCode', [localCode]);
  }

  Future<bool> deleteByLocalCode(String localCode) {
    return deleteByIndex(r'localCode', [localCode]);
  }

  bool deleteByLocalCodeSync(String localCode) {
    return deleteByIndexSync(r'localCode', [localCode]);
  }

  Future<List<OrderModel?>> getAllByLocalCode(List<String> localCodeValues) {
    final values = localCodeValues.map((e) => [e]).toList();
    return getAllByIndex(r'localCode', values);
  }

  List<OrderModel?> getAllByLocalCodeSync(List<String> localCodeValues) {
    final values = localCodeValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'localCode', values);
  }

  Future<int> deleteAllByLocalCode(List<String> localCodeValues) {
    final values = localCodeValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'localCode', values);
  }

  int deleteAllByLocalCodeSync(List<String> localCodeValues) {
    final values = localCodeValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'localCode', values);
  }

  Future<Id> putByLocalCode(OrderModel object) {
    return putByIndex(r'localCode', object);
  }

  Id putByLocalCodeSync(OrderModel object, {bool saveLinks = true}) {
    return putByIndexSync(r'localCode', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByLocalCode(List<OrderModel> objects) {
    return putAllByIndex(r'localCode', objects);
  }

  List<Id> putAllByLocalCodeSync(List<OrderModel> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'localCode', objects, saveLinks: saveLinks);
  }
}

extension OrderModelQueryWhereSort
    on QueryBuilder<OrderModel, OrderModel, QWhere> {
  QueryBuilder<OrderModel, OrderModel, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterWhere> anyIsSynced() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'isSynced'),
      );
    });
  }
}

extension OrderModelQueryWhere
    on QueryBuilder<OrderModel, OrderModel, QWhereClause> {
  QueryBuilder<OrderModel, OrderModel, QAfterWhereClause> idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterWhereClause> idNotEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            )
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            );
      } else {
        return query
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            )
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            );
      }
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterWhereClause> idGreaterThan(Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterWhereClause> idLessThan(Id id,
      {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterWhereClause> idBetween(
    Id lowerId,
    Id upperId, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: lowerId,
        includeLower: includeLower,
        upper: upperId,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterWhereClause> localCodeEqualTo(
      String localCode) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'localCode',
        value: [localCode],
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterWhereClause> localCodeNotEqualTo(
      String localCode) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'localCode',
              lower: [],
              upper: [localCode],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'localCode',
              lower: [localCode],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'localCode',
              lower: [localCode],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'localCode',
              lower: [],
              upper: [localCode],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterWhereClause> storeIdEqualTo(
      String storeId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'storeId',
        value: [storeId],
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterWhereClause> storeIdNotEqualTo(
      String storeId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'storeId',
              lower: [],
              upper: [storeId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'storeId',
              lower: [storeId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'storeId',
              lower: [storeId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'storeId',
              lower: [],
              upper: [storeId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterWhereClause> isSyncedEqualTo(
      bool isSynced) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'isSynced',
        value: [isSynced],
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterWhereClause> isSyncedNotEqualTo(
      bool isSynced) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'isSynced',
              lower: [],
              upper: [isSynced],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'isSynced',
              lower: [isSynced],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'isSynced',
              lower: [isSynced],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'isSynced',
              lower: [],
              upper: [isSynced],
              includeUpper: false,
            ));
      }
    });
  }
}

extension OrderModelQueryFilter
    on QueryBuilder<OrderModel, OrderModel, QFilterCondition> {
  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> createdAtEqualTo(
      DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'createdAt',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      createdAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'createdAt',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> createdAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'createdAt',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> createdAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'createdAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> discountIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'discount',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      discountIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'discount',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> discountEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'discount',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      discountGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'discount',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> discountLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'discount',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> discountBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'discount',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      discountStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'discount',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> discountEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'discount',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> discountContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'discount',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> discountMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'discount',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      discountIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'discount',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      discountIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'discount',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> idEqualTo(
      Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> idGreaterThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> idLessThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> idBetween(
    Id lower,
    Id upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'id',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      installmentsIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'installments',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      installmentsIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'installments',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      installmentsEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'installments',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      installmentsGreaterThan(
    int? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'installments',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      installmentsLessThan(
    int? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'installments',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      installmentsBetween(
    int? lower,
    int? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'installments',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> isSyncedEqualTo(
      bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'isSynced',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      itemsLengthEqualTo(int length) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'items',
        length,
        true,
        length,
        true,
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> itemsIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'items',
        0,
        true,
        0,
        true,
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      itemsIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'items',
        0,
        false,
        999999,
        true,
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      itemsLengthLessThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'items',
        0,
        true,
        length,
        include,
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      itemsLengthGreaterThan(
    int length, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'items',
        length,
        include,
        999999,
        true,
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      itemsLengthBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.listLength(
        r'items',
        lower,
        includeLower,
        upper,
        includeUpper,
      );
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> localCodeEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'localCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      localCodeGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'localCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> localCodeLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'localCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> localCodeBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'localCode',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      localCodeStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'localCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> localCodeEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'localCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> localCodeContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'localCode',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> localCodeMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'localCode',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      localCodeIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'localCode',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      localCodeIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'localCode',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      mesaLabelIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'mesaLabel',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      mesaLabelIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'mesaLabel',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> mesaLabelEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'mesaLabel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      mesaLabelGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'mesaLabel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> mesaLabelLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'mesaLabel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> mesaLabelBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'mesaLabel',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      mesaLabelStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'mesaLabel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> mesaLabelEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'mesaLabel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> mesaLabelContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'mesaLabel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> mesaLabelMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'mesaLabel',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      mesaLabelIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'mesaLabel',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      mesaLabelIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'mesaLabel',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      paymentMethodEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'paymentMethod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      paymentMethodGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'paymentMethod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      paymentMethodLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'paymentMethod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      paymentMethodBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'paymentMethod',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      paymentMethodStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'paymentMethod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      paymentMethodEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'paymentMethod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      paymentMethodContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'paymentMethod',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      paymentMethodMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'paymentMethod',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      paymentMethodIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'paymentMethod',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      paymentMethodIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'paymentMethod',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteNumberIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'remoteNumber',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteNumberIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'remoteNumber',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteNumberEqualTo(int? value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'remoteNumber',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteNumberGreaterThan(
    int? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'remoteNumber',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteNumberLessThan(
    int? value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'remoteNumber',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteNumberBetween(
    int? lower,
    int? upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'remoteNumber',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'remoteOrderId',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'remoteOrderId',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'remoteOrderId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'remoteOrderId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'remoteOrderId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'remoteOrderId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'remoteOrderId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'remoteOrderId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'remoteOrderId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'remoteOrderId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'remoteOrderId',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      remoteOrderIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'remoteOrderId',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> sessaoIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'sessaoId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      sessaoIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'sessaoId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> sessaoIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'sessaoId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> sessaoIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'sessaoId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      sessaoIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'sessaoId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> sessaoIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'sessaoId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> sessaoIdContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'sessaoId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> sessaoIdMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'sessaoId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      sessaoIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'sessaoId',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      sessaoIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'sessaoId',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> storeIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'storeId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      storeIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'storeId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> storeIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'storeId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> storeIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'storeId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> storeIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'storeId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> storeIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'storeId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> storeIdContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'storeId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> storeIdMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'storeId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> storeIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'storeId',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      storeIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'storeId',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> subtotalEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'subtotal',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      subtotalGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'subtotal',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> subtotalLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'subtotal',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> subtotalBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'subtotal',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      subtotalStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'subtotal',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> subtotalEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'subtotal',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> subtotalContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'subtotal',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> subtotalMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'subtotal',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      subtotalIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'subtotal',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      subtotalIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'subtotal',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      syncAttemptsEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'syncAttempts',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      syncAttemptsGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'syncAttempts',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      syncAttemptsLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'syncAttempts',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      syncAttemptsBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'syncAttempts',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      syncErrorIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'syncError',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      syncErrorIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'syncError',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> syncErrorEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'syncError',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      syncErrorGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'syncError',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> syncErrorLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'syncError',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> syncErrorBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'syncError',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      syncErrorStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'syncError',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> syncErrorEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'syncError',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> syncErrorContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'syncError',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> syncErrorMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'syncError',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      syncErrorIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'syncError',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      syncErrorIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'syncError',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> totalEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> totalGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> totalLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> totalBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'total',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> totalStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> totalEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> totalContains(
      String value,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> totalMatches(
      String pattern,
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'total',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> totalIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'total',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition>
      totalIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'total',
        value: '',
      ));
    });
  }
}

extension OrderModelQueryObject
    on QueryBuilder<OrderModel, OrderModel, QFilterCondition> {
  QueryBuilder<OrderModel, OrderModel, QAfterFilterCondition> itemsElement(
      FilterQuery<OrderItemEmbedded> q) {
    return QueryBuilder.apply(this, (query) {
      return query.object(q, r'items');
    });
  }
}

extension OrderModelQueryLinks
    on QueryBuilder<OrderModel, OrderModel, QFilterCondition> {}

extension OrderModelQuerySortBy
    on QueryBuilder<OrderModel, OrderModel, QSortBy> {
  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByDiscount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discount', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByDiscountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discount', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByInstallments() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'installments', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByInstallmentsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'installments', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByIsSynced() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isSynced', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByIsSyncedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isSynced', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByLocalCode() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localCode', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByLocalCodeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localCode', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByMesaLabel() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'mesaLabel', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByMesaLabelDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'mesaLabel', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByPaymentMethod() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentMethod', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByPaymentMethodDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentMethod', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByRemoteNumber() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteNumber', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByRemoteNumberDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteNumber', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByRemoteOrderId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteOrderId', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByRemoteOrderIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteOrderId', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortBySessaoId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sessaoId', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortBySessaoIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sessaoId', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByStoreId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'storeId', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByStoreIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'storeId', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortBySubtotal() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'subtotal', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortBySubtotalDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'subtotal', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortBySyncAttempts() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncAttempts', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortBySyncAttemptsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncAttempts', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortBySyncError() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncError', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortBySyncErrorDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncError', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByTotal() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'total', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> sortByTotalDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'total', Sort.desc);
    });
  }
}

extension OrderModelQuerySortThenBy
    on QueryBuilder<OrderModel, OrderModel, QSortThenBy> {
  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByDiscount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discount', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByDiscountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'discount', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByInstallments() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'installments', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByInstallmentsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'installments', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByIsSynced() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isSynced', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByIsSyncedDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isSynced', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByLocalCode() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localCode', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByLocalCodeDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'localCode', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByMesaLabel() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'mesaLabel', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByMesaLabelDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'mesaLabel', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByPaymentMethod() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentMethod', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByPaymentMethodDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'paymentMethod', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByRemoteNumber() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteNumber', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByRemoteNumberDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteNumber', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByRemoteOrderId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteOrderId', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByRemoteOrderIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteOrderId', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenBySessaoId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sessaoId', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenBySessaoIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'sessaoId', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByStoreId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'storeId', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByStoreIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'storeId', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenBySubtotal() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'subtotal', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenBySubtotalDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'subtotal', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenBySyncAttempts() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncAttempts', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenBySyncAttemptsDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncAttempts', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenBySyncError() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncError', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenBySyncErrorDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'syncError', Sort.desc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByTotal() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'total', Sort.asc);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QAfterSortBy> thenByTotalDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'total', Sort.desc);
    });
  }
}

extension OrderModelQueryWhereDistinct
    on QueryBuilder<OrderModel, OrderModel, QDistinct> {
  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'createdAt');
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctByDiscount(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'discount', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctByInstallments() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'installments');
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctByIsSynced() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'isSynced');
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctByLocalCode(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'localCode', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctByMesaLabel(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'mesaLabel', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctByPaymentMethod(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'paymentMethod',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctByRemoteNumber() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'remoteNumber');
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctByRemoteOrderId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'remoteOrderId',
          caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctBySessaoId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'sessaoId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctByStoreId(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'storeId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctBySubtotal(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'subtotal', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctBySyncAttempts() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'syncAttempts');
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctBySyncError(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'syncError', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<OrderModel, OrderModel, QDistinct> distinctByTotal(
      {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'total', caseSensitive: caseSensitive);
    });
  }
}

extension OrderModelQueryProperty
    on QueryBuilder<OrderModel, OrderModel, QQueryProperty> {
  QueryBuilder<OrderModel, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<OrderModel, DateTime, QQueryOperations> createdAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'createdAt');
    });
  }

  QueryBuilder<OrderModel, String?, QQueryOperations> discountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'discount');
    });
  }

  QueryBuilder<OrderModel, int?, QQueryOperations> installmentsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'installments');
    });
  }

  QueryBuilder<OrderModel, bool, QQueryOperations> isSyncedProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'isSynced');
    });
  }

  QueryBuilder<OrderModel, List<OrderItemEmbedded>, QQueryOperations>
      itemsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'items');
    });
  }

  QueryBuilder<OrderModel, String, QQueryOperations> localCodeProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'localCode');
    });
  }

  QueryBuilder<OrderModel, String?, QQueryOperations> mesaLabelProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'mesaLabel');
    });
  }

  QueryBuilder<OrderModel, String, QQueryOperations> paymentMethodProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'paymentMethod');
    });
  }

  QueryBuilder<OrderModel, int?, QQueryOperations> remoteNumberProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'remoteNumber');
    });
  }

  QueryBuilder<OrderModel, String?, QQueryOperations> remoteOrderIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'remoteOrderId');
    });
  }

  QueryBuilder<OrderModel, String, QQueryOperations> sessaoIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'sessaoId');
    });
  }

  QueryBuilder<OrderModel, String, QQueryOperations> storeIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'storeId');
    });
  }

  QueryBuilder<OrderModel, String, QQueryOperations> subtotalProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'subtotal');
    });
  }

  QueryBuilder<OrderModel, int, QQueryOperations> syncAttemptsProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'syncAttempts');
    });
  }

  QueryBuilder<OrderModel, String?, QQueryOperations> syncErrorProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'syncError');
    });
  }

  QueryBuilder<OrderModel, String, QQueryOperations> totalProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'total');
    });
  }
}

// **************************************************************************
// IsarEmbeddedGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

const OrderItemEmbeddedSchema = Schema(
  name: r'OrderItemEmbedded',
  id: 6372615220027013686,
  properties: {
    r'productEmoji': PropertySchema(
      id: 0,
      name: r'productEmoji',
      type: IsarType.string,
    ),
    r'productId': PropertySchema(
      id: 1,
      name: r'productId',
      type: IsarType.string,
    ),
    r'productName': PropertySchema(
      id: 2,
      name: r'productName',
      type: IsarType.string,
    ),
    r'quantity': PropertySchema(
      id: 3,
      name: r'quantity',
      type: IsarType.long,
    ),
    r'total': PropertySchema(
      id: 4,
      name: r'total',
      type: IsarType.string,
    ),
    r'unitPrice': PropertySchema(
      id: 5,
      name: r'unitPrice',
      type: IsarType.string,
    )
  },
  estimateSize: _orderItemEmbeddedEstimateSize,
  serialize: _orderItemEmbeddedSerialize,
  deserialize: _orderItemEmbeddedDeserialize,
  deserializeProp: _orderItemEmbeddedDeserializeProp,
);

int _orderItemEmbeddedEstimateSize(
  OrderItemEmbedded object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  {
    final value = object.productEmoji;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  {
    final value = object.productId;
    if (value != null) {
      bytesCount += 3 + value.length * 3;
    }
  }
  bytesCount += 3 + object.productName.length * 3;
  bytesCount += 3 + object.total.length * 3;
  bytesCount += 3 + object.unitPrice.length * 3;
  return bytesCount;
}

void _orderItemEmbeddedSerialize(
  OrderItemEmbedded object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.productEmoji);
  writer.writeString(offsets[1], object.productId);
  writer.writeString(offsets[2], object.productName);
  writer.writeLong(offsets[3], object.quantity);
  writer.writeString(offsets[4], object.total);
  writer.writeString(offsets[5], object.unitPrice);
}

OrderItemEmbedded _orderItemEmbeddedDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = OrderItemEmbedded();
  object.productEmoji = reader.readStringOrNull(offsets[0]);
  object.productId = reader.readStringOrNull(offsets[1]);
  object.productName = reader.readString(offsets[2]);
  object.quantity = reader.readLong(offsets[3]);
  object.total = reader.readString(offsets[4]);
  object.unitPrice = reader.readString(offsets[5]);
  return object;
}

P _orderItemEmbeddedDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readStringOrNull(offset)) as P;
    case 1:
      return (reader.readStringOrNull(offset)) as P;
    case 2:
      return (reader.readString(offset)) as P;
    case 3:
      return (reader.readLong(offset)) as P;
    case 4:
      return (reader.readString(offset)) as P;
    case 5:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

extension OrderItemEmbeddedQueryFilter
    on QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QFilterCondition> {
  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'productEmoji',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'productEmoji',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'productEmoji',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'productEmoji',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'productEmoji',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'productEmoji',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'productEmoji',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'productEmoji',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'productEmoji',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'productEmoji',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'productEmoji',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productEmojiIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'productEmoji',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdIsNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNull(
        property: r'productId',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdIsNotNull() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(const FilterCondition.isNotNull(
        property: r'productId',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdEqualTo(
    String? value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'productId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdGreaterThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'productId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdLessThan(
    String? value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'productId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdBetween(
    String? lower,
    String? upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'productId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'productId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'productId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'productId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'productId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'productId',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'productId',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productNameEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'productName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productNameGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'productName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productNameLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'productName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productNameBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'productName',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productNameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'productName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productNameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'productName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productNameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'productName',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productNameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'productName',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productNameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'productName',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      productNameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'productName',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      quantityEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'quantity',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      quantityGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'quantity',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      quantityLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'quantity',
        value: value,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      quantityBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'quantity',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      totalEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      totalGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      totalLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      totalBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'total',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      totalStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      totalEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      totalContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'total',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      totalMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'total',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      totalIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'total',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      totalIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'total',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      unitPriceEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'unitPrice',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      unitPriceGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'unitPrice',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      unitPriceLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'unitPrice',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      unitPriceBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'unitPrice',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      unitPriceStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'unitPrice',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      unitPriceEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'unitPrice',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      unitPriceContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'unitPrice',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      unitPriceMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'unitPrice',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      unitPriceIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'unitPrice',
        value: '',
      ));
    });
  }

  QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QAfterFilterCondition>
      unitPriceIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'unitPrice',
        value: '',
      ));
    });
  }
}

extension OrderItemEmbeddedQueryObject
    on QueryBuilder<OrderItemEmbedded, OrderItemEmbedded, QFilterCondition> {}
