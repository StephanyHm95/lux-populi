CREATE DATABASE  IF NOT EXISTS `luxpopuli` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `luxpopuli`;
-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: luxpopuli
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `concepto`
--

DROP TABLE IF EXISTS `concepto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `concepto` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `precio` decimal(10,2) NOT NULL,
  `aplica_a` enum('casa','edificio','ambos') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ambos',
  `solo_plana` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_concepto_precio` CHECK ((`precio` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `concepto`
--

LOCK TABLES `concepto` WRITE;
/*!40000 ALTER TABLE `concepto` DISABLE KEYS */;
INSERT INTO `concepto` VALUES (1,'Legalización',1000.00,'ambos',0),(2,'Estructura para cubierta plana',1000.00,'ambos',1);
/*!40000 ALTER TABLE `concepto` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `franja`
--

DROP TABLE IF EXISTS `franja`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `franja` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provincia_id` int NOT NULL,
  `fecha` date NOT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  `ocupada` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_franja_busqueda` (`provincia_id`,`ocupada`,`fecha`,`hora_inicio`),
  CONSTRAINT `fk_franja_provincia` FOREIGN KEY (`provincia_id`) REFERENCES `provincia` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_franja_horas` CHECK ((`hora_fin` > `hora_inicio`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `franja`
--

LOCK TABLES `franja` WRITE;
/*!40000 ALTER TABLE `franja` DISABLE KEYS */;
/*!40000 ALTER TABLE `franja` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parametro`
--

DROP TABLE IF EXISTS `parametro`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parametro` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clave` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `valor` decimal(10,4) NOT NULL,
  `unidad` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clave` (`clave`),
  CONSTRAINT `chk_parametro_valor` CHECK ((`valor` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parametro`
--

LOCK TABLES `parametro` WRITE;
/*!40000 ALTER TABLE `parametro` DISABLE KEYS */;
INSERT INTO `parametro` VALUES (1,'precio_kwp','Precio por kWp',1300.0000,'€/kWp'),(2,'potencia_panel','Potencia del panel',0.4500,'kWp'),(3,'precio_luz','Precio de la luz',0.1900,'€/kWh'),(4,'precio_compensacion','Precio de compensación',0.0800,'€/kWh');
/*!40000 ALTER TABLE `parametro` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `presupuesto`
--

DROP TABLE IF EXISTS `presupuesto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `presupuesto` (
  `id` int NOT NULL AUTO_INCREMENT,
  `solicitud_id` int NOT NULL,
  `importe` decimal(10,2) NOT NULL,
  `archivo_pdf` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_envio` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_respuesta` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `solicitud_id` (`solicitud_id`),
  CONSTRAINT `fk_presupuesto_solicitud` FOREIGN KEY (`solicitud_id`) REFERENCES `solicitud` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_presupuesto_importe` CHECK ((`importe` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `presupuesto`
--

LOCK TABLES `presupuesto` WRITE;
/*!40000 ALTER TABLE `presupuesto` DISABLE KEYS */;
/*!40000 ALTER TABLE `presupuesto` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `produccion_mensual`
--

DROP TABLE IF EXISTS `produccion_mensual`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `produccion_mensual` (
  `provincia_id` int NOT NULL,
  `mes` tinyint NOT NULL,
  `produccion` decimal(6,2) NOT NULL,
  `radiacion` decimal(6,2) NOT NULL,
  PRIMARY KEY (`provincia_id`,`mes`),
  CONSTRAINT `fk_produccion_mensual_provincia` FOREIGN KEY (`provincia_id`) REFERENCES `provincia` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_produccion_mes` CHECK ((`mes` between 1 and 12))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produccion_mensual`
--

LOCK TABLES `produccion_mensual` WRITE;
/*!40000 ALTER TABLE `produccion_mensual` DISABLE KEYS */;
/*!40000 ALTER TABLE `produccion_mensual` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `provincia`
--

DROP TABLE IF EXISTS `provincia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `provincia` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` char(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitud` decimal(8,5) NOT NULL,
  `longitud` decimal(8,5) NOT NULL,
  `produccion_anual` decimal(7,2) DEFAULT NULL,
  `radiacion_anual` decimal(7,2) DEFAULT NULL,
  `fecha_pvgis` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  CONSTRAINT `chk_provincia_codigo` CHECK (regexp_like(`codigo`,_utf8mb4'^(0[1-9]|[1-4][0-9]|5[0-2])$'))
) ENGINE=InnoDB AUTO_INCREMENT=53 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `provincia`
--

LOCK TABLES `provincia` WRITE;
/*!40000 ALTER TABLE `provincia` DISABLE KEYS */;
INSERT INTO `provincia` VALUES (1,'01','Álava',42.84670,-2.67160,NULL,NULL,NULL),(2,'02','Albacete',38.99430,-1.85850,NULL,NULL,NULL),(3,'03','Alicante',38.34600,-0.49070,NULL,NULL,NULL),(4,'04','Almería',36.84020,-2.46790,NULL,NULL,NULL),(5,'05','Ávila',40.65640,-4.70030,NULL,NULL,NULL),(6,'06','Badajoz',38.87940,-6.97070,NULL,NULL,NULL),(7,'07','Illes Balears',39.57700,2.65000,NULL,NULL,NULL),(8,'08','Barcelona',41.38700,2.17000,NULL,NULL,NULL),(9,'09','Burgos',42.34390,-3.69690,NULL,NULL,NULL),(10,'10','Cáceres',39.47530,-6.37240,NULL,NULL,NULL),(11,'11','Cádiz',36.52980,-6.29250,NULL,NULL,NULL),(12,'12','Castellón',39.98640,-0.05130,NULL,NULL,NULL),(13,'13','Ciudad Real',38.98480,-3.92740,NULL,NULL,NULL),(14,'14','Córdoba',37.88820,-4.77940,NULL,NULL,NULL),(15,'15','A Coruña',43.36000,-8.41000,NULL,NULL,NULL),(16,'16','Cuenca',40.07040,-2.13740,NULL,NULL,NULL),(17,'17','Girona',41.97940,2.82140,NULL,NULL,NULL),(18,'18','Granada',37.17730,-3.59860,NULL,NULL,NULL),(19,'19','Guadalajara',40.63300,-3.16690,NULL,NULL,NULL),(20,'20','Gipuzkoa',43.31830,-1.98120,NULL,NULL,NULL),(21,'21','Huelva',37.26140,-6.94470,NULL,NULL,NULL),(22,'22','Huesca',42.14010,-0.40890,NULL,NULL,NULL),(23,'23','Jaén',37.77960,-3.78490,NULL,NULL,NULL),(24,'24','León',42.59870,-5.56710,NULL,NULL,NULL),(25,'25','Lleida',41.61760,0.62000,NULL,NULL,NULL),(26,'26','La Rioja',42.46270,-2.44500,NULL,NULL,NULL),(27,'27','Lugo',43.00970,-7.55600,NULL,NULL,NULL),(28,'28','Madrid',40.41680,-3.70380,NULL,NULL,NULL),(29,'29','Málaga',36.72130,-4.42140,NULL,NULL,NULL),(30,'30','Murcia',37.99220,-1.13070,NULL,NULL,NULL),(31,'31','Navarra',42.81250,-1.64580,NULL,NULL,NULL),(32,'32','Ourense',42.33580,-7.86390,NULL,NULL,NULL),(33,'33','Asturias',43.36140,-5.84940,NULL,NULL,NULL),(34,'34','Palencia',42.00950,-4.52880,NULL,NULL,NULL),(35,'35','Las Palmas',28.12350,-15.43630,NULL,NULL,NULL),(36,'36','Pontevedra',42.43100,-8.64460,NULL,NULL,NULL),(37,'37','Salamanca',40.97010,-5.66350,NULL,NULL,NULL),(38,'38','Santa Cruz de Tenerife',28.46360,-16.25180,NULL,NULL,NULL),(39,'39','Cantabria',43.46230,-3.80990,NULL,NULL,NULL),(40,'40','Segovia',40.94290,-4.10880,NULL,NULL,NULL),(41,'41','Sevilla',37.38910,-5.98450,NULL,NULL,NULL),(42,'42','Soria',41.76660,-2.47900,NULL,NULL,NULL),(43,'43','Tarragona',41.11890,1.24450,NULL,NULL,NULL),(44,'44','Teruel',40.34570,-1.10650,NULL,NULL,NULL),(45,'45','Toledo',39.86280,-4.02730,NULL,NULL,NULL),(46,'46','Valencia',39.46990,-0.37630,NULL,NULL,NULL),(47,'47','Valladolid',41.65230,-4.72450,NULL,NULL,NULL),(48,'48','Bizkaia',43.26300,-2.93500,NULL,NULL,NULL),(49,'49','Zamora',41.50340,-5.74670,NULL,NULL,NULL),(50,'50','Zaragoza',41.64880,-0.88910,NULL,NULL,NULL),(51,'51','Ceuta',35.88940,-5.32130,NULL,NULL,NULL),(52,'52','Melilla',35.29230,-2.93810,NULL,NULL,NULL);
/*!40000 ALTER TABLE `provincia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `simulacion`
--

DROP TABLE IF EXISTS `simulacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `simulacion` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provincia_id` int NOT NULL,
  `tipo_instalacion` enum('casa','edificio') COLLATE utf8mb4_unicode_ci NOT NULL,
  `codigo_postal` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo_tejado` enum('inclinado','plano') COLLATE utf8mb4_unicode_ci NOT NULL,
  `superficie` decimal(8,2) NOT NULL,
  `consumo_mensual` decimal(8,2) DEFAULT NULL,
  `num_viviendas` int DEFAULT NULL,
  `consumo_vivienda` decimal(8,2) DEFAULT NULL,
  `incluir_zonas_comunes` tinyint(1) NOT NULL DEFAULT '0',
  `consumo_zonas_comunes` decimal(8,2) DEFAULT NULL,
  `produccion_usada` decimal(7,2) NOT NULL,
  `paneles_finales` int NOT NULL,
  `potencia_instalada` decimal(6,2) NOT NULL,
  `tejado_limita` tinyint(1) NOT NULL,
  `coste` decimal(10,2) NOT NULL,
  `ahorro_anual` decimal(10,2) NOT NULL,
  `amortizacion` decimal(5,1) NOT NULL,
  `coste_por_vivienda` decimal(10,2) DEFAULT NULL,
  `ahorro_por_vivienda` decimal(10,2) DEFAULT NULL,
  `fecha_creacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_simulacion_provincia` (`provincia_id`),
  CONSTRAINT `fk_simulacion_provincia` FOREIGN KEY (`provincia_id`) REFERENCES `provincia` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_simulacion_cp` CHECK (regexp_like(`codigo_postal`,_utf8mb4'^[0-9]{5}$')),
  CONSTRAINT `chk_simulacion_entradas` CHECK ((((`tipo_instalacion` = _utf8mb4'casa') and (`consumo_mensual` > 0) and (`num_viviendas` is null) and (`consumo_vivienda` is null) and (`incluir_zonas_comunes` = false) and (`consumo_zonas_comunes` is null) and (`coste_por_vivienda` is null) and (`ahorro_por_vivienda` is null)) or ((`tipo_instalacion` = _utf8mb4'edificio') and (`consumo_mensual` is null) and (`num_viviendas` >= 2) and (`consumo_vivienda` > 0) and (`coste_por_vivienda` is not null) and (`ahorro_por_vivienda` is not null) and (((`incluir_zonas_comunes` = false) and (`consumo_zonas_comunes` is null)) or ((`incluir_zonas_comunes` = true) and (`consumo_zonas_comunes` >= 0)))))),
  CONSTRAINT `chk_simulacion_superficie` CHECK ((`superficie` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `simulacion`
--

LOCK TABLES `simulacion` WRITE;
/*!40000 ALTER TABLE `simulacion` DISABLE KEYS */;
/*!40000 ALTER TABLE `simulacion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `solicitud`
--

DROP TABLE IF EXISTS `solicitud`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `solicitud` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `simulacion_id` int NOT NULL,
  `franja_id` int NOT NULL,
  `direccion` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `municipio` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `codigo_postal` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` enum('solicitada','enviada','presupuesto_enviado','aceptado','rechazado','cancelada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'solicitada',
  `email_instalador` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fecha_solicitud` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_estado` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `simulacion_id` (`simulacion_id`),
  KEY `idx_solicitud_usuario_estado` (`usuario_id`,`estado`),
  KEY `idx_solicitud_franja_estado` (`franja_id`,`estado`),
  CONSTRAINT `fk_solicitud_franja` FOREIGN KEY (`franja_id`) REFERENCES `franja` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_solicitud_simulacion` FOREIGN KEY (`simulacion_id`) REFERENCES `simulacion` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_solicitud_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_solicitud_cp` CHECK (regexp_like(`codigo_postal`,_utf8mb4'^[0-9]{5}$'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `solicitud`
--

LOCK TABLES `solicitud` WRITE;
/*!40000 ALTER TABLE `solicitud` DISABLE KEYS */;
/*!40000 ALTER TABLE `solicitud` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuario`
--

DROP TABLE IF EXISTS `usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuario` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apellidos` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono` varchar(9) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rol` enum('cliente','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'cliente',
  `fecha_registro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario`
--

LOCK TABLES `usuario` WRITE;
/*!40000 ALTER TABLE `usuario` DISABLE KEYS */;
INSERT INTO `usuario` VALUES (1,'Admin','Lux Populi','admin@luxpopuli.es','600000001','$2b$10$xSfoIrlVwjttzx33lZNJluDD9MmStyl8CcRhHZjZVtDF70cvfUQdy','admin','2026-10-21 19:56:35');
/*!40000 ALTER TABLE `usuario` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'luxpopuli'
--

--
-- Dumping routines for database 'luxpopuli'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-21 20:00:00
