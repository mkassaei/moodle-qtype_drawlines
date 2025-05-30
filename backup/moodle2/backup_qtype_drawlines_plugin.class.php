<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Provides the information to backup drawlines questions.
 *
 * @package qtype_drawlines
 * @copyright 2024 The Open University
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class backup_qtype_drawlines_plugin extends backup_qtype_plugin {
    /**
     * Returns the qtype name.
     *
     * @return string The type name
     */
    protected static function qtype_name() {
        return 'drawlines';
    }

    /**
     * Returns the qtype information to attach to question element.
     */
    protected function define_question_plugin_structure() {

        $plugin = $this->get_plugin_element(null, '../../qtype', self::qtype_name());

        $pluginwrapper = new backup_nested_element($this->get_recommended_name());

        $plugin->add_child($pluginwrapper);

        $options = new backup_nested_element('drawlines', ['id'], [
                'grademethod',
                'correctfeedback', 'correctfeedbackformat',
                'partiallycorrectfeedback', 'partiallycorrectfeedbackformat',
                'incorrectfeedback', 'incorrectfeedbackformat',
                'shownumcorrect', 'showmisplaced',
        ]);
        $pluginwrapper->add_child($options);

        $lines = new backup_nested_element('lines');
        $line = new backup_nested_element('line', ['id'], ['number', 'type',
                'labelstart', 'labelmiddle', 'labelend', 'zonestart', 'zoneend']);
        $lines->add_child($line);
        $pluginwrapper->add_child($lines);

        $options->set_source_table('qtype_drawlines_options', ['questionid' => backup::VAR_PARENTID]);
        $line->set_source_table('qtype_drawlines_lines', ['questionid' => backup::VAR_PARENTID]);

        return $plugin;
    }

    /**
     * Returns one array with filearea => mappingname elements for the qtype
     *
     * Used by {@link get_components_and_fileareas} to know about all the qtype
     * files to be processed both in backup and restore.
     */
    public static function get_qtype_fileareas() {
        return [
            'bgimage' => 'question_created',
            'correctfeedback' => 'question_created',
            'partiallycorrectfeedback' => 'question_created',
            'incorrectfeedback' => 'question_created',
        ];
    }
}
