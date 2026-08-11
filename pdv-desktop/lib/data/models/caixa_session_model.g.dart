// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'caixa_session_model.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetCaixaSessionModelCollection on Isar {
  IsarCollection<CaixaSessionModel> get caixaSessionModels => this.collection();
}

const CaixaSessionModelSchema = CollectionSchema(
  name: r'CaixaSessionModel',
  id: 4623785928632054249,
  properties: {
    r'openedAt': PropertySchema(
      id: 0,
      name: r'openedAt',
      type: IsarType.dateTime,
    ),
    r'remoteId': PropertySchema(
      id: 1,
      name: r'remoteId',
      type: IsarType.string,
    ),
    r'saldoInicial': PropertySchema(
      id: 2,
      name: r'saldoInicial',
      type: IsarType.string,
    )
  },
  estimateSize: _caixaSessionModelEstimateSize,
  serialize: _caixaSessionModelSerialize,
  deserialize: _caixaSessionModelDeserialize,
  deserializeProp: _caixaSessionModelDeserializeProp,
  idName: r'id',
  indexes: {},
  links: {},
  embeddedSchemas: {},
  getId: _caixaSessionModelGetId,
  getLinks: _caixaSessionModelGetLinks,
  attach: _caixaSessionModelAttach,
  version: '3.1.0+1',
);

int _caixaSessionModelEstimateSize(
  CaixaSessionModel object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.remoteId.length * 3;
  bytesCount += 3 + object.saldoInicial.length * 3;
  return bytesCount;
}

void _caixaSessionModelSerialize(
  CaixaSessionModel object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeDateTime(offsets[0], object.openedAt);
  writer.writeString(offsets[1], object.remoteId);
  writer.writeString(offsets[2], object.saldoInicial);
}

CaixaSessionModel _caixaSessionModelDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = CaixaSessionModel();
  object.id = id;
  object.openedAt = reader.readDateTime(offsets[0]);
  object.remoteId = reader.readString(offsets[1]);
  object.saldoInicial = reader.readString(offsets[2]);
  return object;
}

P _caixaSessionModelDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readDateTime(offset)) as P;
    case 1:
      return (reader.readString(offset)) as P;
    case 2:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _caixaSessionModelGetId(CaixaSessionModel object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _caixaSessionModelGetLinks(
    CaixaSessionModel object) {
  return [];
}

void _caixaSessionModelAttach(
    IsarCollection<dynamic> col, Id id, CaixaSessionModel object) {
  object.id = id;
}

extension CaixaSessionModelQueryWhereSort
    on QueryBuilder<CaixaSessionModel, CaixaSessionModel, QWhere> {
  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension CaixaSessionModelQueryWhere
    on QueryBuilder<CaixaSessionModel, CaixaSessionModel, QWhereClause> {
  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterWhereClause>
      idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterWhereClause>
      idNotEqualTo(Id id) {
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

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterWhereClause>
      idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterWhereClause>
      idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterWhereClause>
      idBetween(
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
}

extension CaixaSessionModelQueryFilter
    on QueryBuilder<CaixaSessionModel, CaixaSessionModel, QFilterCondition> {
  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      idGreaterThan(
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

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      idLessThan(
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

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      idBetween(
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

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      openedAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'openedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      openedAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'openedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      openedAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'openedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      openedAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'openedAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      remoteIdEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'remoteId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      remoteIdGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'remoteId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      remoteIdLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'remoteId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      remoteIdBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'remoteId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      remoteIdStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'remoteId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      remoteIdEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'remoteId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      remoteIdContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'remoteId',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      remoteIdMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'remoteId',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      remoteIdIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'remoteId',
        value: '',
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      remoteIdIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'remoteId',
        value: '',
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      saldoInicialEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'saldoInicial',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      saldoInicialGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'saldoInicial',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      saldoInicialLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'saldoInicial',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      saldoInicialBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'saldoInicial',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      saldoInicialStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'saldoInicial',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      saldoInicialEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'saldoInicial',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      saldoInicialContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'saldoInicial',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      saldoInicialMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'saldoInicial',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      saldoInicialIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'saldoInicial',
        value: '',
      ));
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterFilterCondition>
      saldoInicialIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'saldoInicial',
        value: '',
      ));
    });
  }
}

extension CaixaSessionModelQueryObject
    on QueryBuilder<CaixaSessionModel, CaixaSessionModel, QFilterCondition> {}

extension CaixaSessionModelQueryLinks
    on QueryBuilder<CaixaSessionModel, CaixaSessionModel, QFilterCondition> {}

extension CaixaSessionModelQuerySortBy
    on QueryBuilder<CaixaSessionModel, CaixaSessionModel, QSortBy> {
  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      sortByOpenedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'openedAt', Sort.asc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      sortByOpenedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'openedAt', Sort.desc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      sortByRemoteId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteId', Sort.asc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      sortByRemoteIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteId', Sort.desc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      sortBySaldoInicial() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'saldoInicial', Sort.asc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      sortBySaldoInicialDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'saldoInicial', Sort.desc);
    });
  }
}

extension CaixaSessionModelQuerySortThenBy
    on QueryBuilder<CaixaSessionModel, CaixaSessionModel, QSortThenBy> {
  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy> thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      thenByOpenedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'openedAt', Sort.asc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      thenByOpenedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'openedAt', Sort.desc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      thenByRemoteId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteId', Sort.asc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      thenByRemoteIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'remoteId', Sort.desc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      thenBySaldoInicial() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'saldoInicial', Sort.asc);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QAfterSortBy>
      thenBySaldoInicialDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'saldoInicial', Sort.desc);
    });
  }
}

extension CaixaSessionModelQueryWhereDistinct
    on QueryBuilder<CaixaSessionModel, CaixaSessionModel, QDistinct> {
  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QDistinct>
      distinctByOpenedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'openedAt');
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QDistinct>
      distinctByRemoteId({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'remoteId', caseSensitive: caseSensitive);
    });
  }

  QueryBuilder<CaixaSessionModel, CaixaSessionModel, QDistinct>
      distinctBySaldoInicial({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'saldoInicial', caseSensitive: caseSensitive);
    });
  }
}

extension CaixaSessionModelQueryProperty
    on QueryBuilder<CaixaSessionModel, CaixaSessionModel, QQueryProperty> {
  QueryBuilder<CaixaSessionModel, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<CaixaSessionModel, DateTime, QQueryOperations>
      openedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'openedAt');
    });
  }

  QueryBuilder<CaixaSessionModel, String, QQueryOperations> remoteIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'remoteId');
    });
  }

  QueryBuilder<CaixaSessionModel, String, QQueryOperations>
      saldoInicialProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'saldoInicial');
    });
  }
}
