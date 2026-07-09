CREATE DATABASE `aiforge` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `aiforge`;

-- aiforge.reserved_usernames definition

CREATE TABLE `reserved_usernames` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT (uuid()),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL,
  `username` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `index__reserved_usernames__username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- aiforge.users definition

CREATE TABLE `users` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `email` varchar(255) NOT NULL,
  `provider_id` varchar(255) NOT NULL,
  `provider` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `provider_type` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `first_name` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `username` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `updated_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `created_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `bio` varchar(3000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `profile_image_public` tinyint(1) NOT NULL DEFAULT '1',
  `picture` varchar(256) NOT NULL DEFAULT '',
  `github` varchar(128) NOT NULL DEFAULT '',
  `twitter` varchar(128) NOT NULL DEFAULT '',
  `linkedin` varchar(128) NOT NULL DEFAULT '',
  `last_login` timestamp NULL DEFAULT NULL,
  `service_account` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `users.unique.email` (`email`),
  UNIQUE KEY `users.unique.provider_id` (`provider_id`),
  UNIQUE KEY `users.unique.username` (`username`),
  KEY `users.fk.created_by.users` (`created_by`),
  KEY `users.fk.updated_by.users` (`updated_by`),
  CONSTRAINT `users_users_FK` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `users_users_FK_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- aiforge.errors definition

CREATE TABLE `errors` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `updated_by` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `source` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `code` varchar(128) NOT NULL,
  `description` varchar(10240) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk__errors_users__created_by__id` (`created_by`),
  KEY `fk__errors_users__updated_by__id` (`updated_by`),
  KEY `index__errors__source` (`source`),
  CONSTRAINT `fk__errors_users__created_by__id` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk__errors_users__updated_by__id` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- aiforge.project_parents definition

CREATE TABLE `project_parents` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT (uuid()),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL,
  `username` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `project_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `project_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `public_access` tinyint(1) NOT NULL DEFAULT '1',
  `fork_of` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `project_description` varchar(10000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `about` varchar(350) NOT NULL DEFAULT '',
  `parameters` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk__project_parents__project_name__username` (`project_name`,`username`),
  KEY `index__project_parents__username` (`username`),
  KEY `index__project_parents__public_access` (`public_access`),
  KEY `index__project_parents__project_type` (`project_type`),
  KEY `fk__project_parents__users__created_by__id` (`created_by`),
  KEY `fk__project_parents__users__updated_by__id` (`updated_by`),
  KEY `fk__project_parents__project_parents__fork_of__id` (`fork_of`),
  CONSTRAINT `fk__project_parents__project_parents__fork_of__id` FOREIGN KEY (`fork_of`) REFERENCES `project_parents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk__project_parents__users__created_by__id` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk__project_parents__users__updated_by__id` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk__project_parents__users__username__username` FOREIGN KEY (`username`) REFERENCES `users` (`username`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- aiforge.stars definition

CREATE TABLE `stars` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT (uuid()),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL,
  `project_parent` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `username` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk__stars__project_parent__username` (`project_parent`,`username`),
  KEY `index__stars__username` (`username`),
  KEY `fk__stars__users__created_by__id` (`created_by`),
  KEY `fk__stars__users__updated_by__id` (`updated_by`),
  CONSTRAINT `fk__stars__projects_parents__project_parent__id` FOREIGN KEY (`project_parent`) REFERENCES `project_parents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk__stars__users__created_by__id` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk__stars__users__updated_by__id` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk__stars__users__username__id` FOREIGN KEY (`username`) REFERENCES `users` (`username`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- aiforge.downloads definition

CREATE TABLE `downloads` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT (uuid()),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL,
  `project_parent` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `username` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `index__downloads__username` (`username`),
  KEY `fk__downloads__users__created_by__id` (`created_by`),
  KEY `fk__downloads__users__updated_by__id` (`updated_by`),
  KEY `fk__downloads__project_parents__project_parent__id` (`project_parent`),
  CONSTRAINT `fk__downloads__project_parents__project_parent__id` FOREIGN KEY (`project_parent`) REFERENCES `project_parents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk__downloads__users__created_by__id` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk__downloads__users__updated_by__id` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk__downloads__users__username__id` FOREIGN KEY (`username`) REFERENCES `users` (`username`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- aiforge.llm_configs definition

CREATE TABLE `llm_configs` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT (uuid()),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL,
  `project_parent` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `branch` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '1',
  `loss_fn` varchar(64) DEFAULT NULL,
  `optimizer` varchar(64) DEFAULT NULL,
  `learning_rate` float DEFAULT NULL,
  `epochs` int DEFAULT NULL,
  `batch_size` int DEFAULT NULL,
  `validation_split` float DEFAULT NULL,
  `metrics` json DEFAULT NULL,
  `layers` json DEFAULT NULL,
  `metrics_history` json DEFAULT NULL,
  `saved_model` tinyint(1) NOT NULL DEFAULT '0',
  `project_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `backend` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `sequence_length` int DEFAULT NULL,
  `pretraining_stride` int DEFAULT NULL,
  `finetuning_stride` int DEFAULT NULL,
  `pretraining_datasets` json DEFAULT NULL,
  `finetuning_datasets` json DEFAULT NULL,
  `tokenizer` varchar(128) DEFAULT NULL,
  `vocab_size` int DEFAULT NULL,
  `input_shape` json DEFAULT NULL,
  `model_type` varchar(128) DEFAULT NULL,
  `num_heads` mediumint unsigned DEFAULT NULL,
  `num_layers` mediumint unsigned DEFAULT NULL,
  `embed_dim` mediumint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk__llm_configs__project_parent__branch` (`project_parent`,`branch`),
  KEY `index__llm_configs__project_parent` (`project_parent`),
  KEY `fk__project__users__created_by__id` (`created_by`),
  KEY `fk__llm_configs__users__updated_by__id` (`updated_by`),
  CONSTRAINT `fk__llm_configs__project_parents__project_parent__id` FOREIGN KEY (`project_parent`) REFERENCES `project_parents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk__llm_configs__users__created_by__id` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `llm_configs_users_FK` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- aiforge.project_configs definition

CREATE TABLE `project_configs` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT (uuid()),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL,
  `project_parent` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `branch` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '1',
  `loss_fn` varchar(64) DEFAULT NULL,
  `optimizer` varchar(64) DEFAULT NULL,
  `learning_rate` float DEFAULT NULL,
  `epochs` int DEFAULT NULL,
  `batch_size` int DEFAULT NULL,
  `use_gpu` tinyint(1) DEFAULT NULL,
  `validation_split` float DEFAULT NULL,
  `metrics` json DEFAULT NULL,
  `layers` json DEFAULT NULL,
  `input_cols` json DEFAULT NULL,
  `target_cols` json DEFAULT NULL,
  `scale_cols` json DEFAULT NULL,
  `vocab_size` int DEFAULT NULL,
  `sentence_length` int DEFAULT NULL,
  `filters` json DEFAULT NULL,
  `input_shape` json DEFAULT NULL,
  `onehot_encoding` json DEFAULT NULL,
  `metrics_history` json DEFAULT NULL,
  `saved_model` tinyint(1) NOT NULL DEFAULT '0',
  `project_type` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `dummy_variables` json DEFAULT NULL,
  `zscore_cols` json DEFAULT NULL,
  `backend` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `finetune` json DEFAULT NULL,
  `tokenizer` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk__project_configs__project_parent__branch` (`project_parent`,`branch`),
  KEY `index__project_configs__project_parent` (`project_parent`),
  KEY `fk__project__users__created_by__id` (`created_by`),
  KEY `fk__project_configs__users__updated_by__id` (`updated_by`),
  CONSTRAINT `fk__project__users__created_by__id` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk__project_configs__project_parents__project_parent__id` FOREIGN KEY (`project_parent`) REFERENCES `project_parents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk__project_configs__users__updated_by__id` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
