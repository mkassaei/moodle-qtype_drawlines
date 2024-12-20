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

namespace qtype_drawlines;

use question_attempt_step;
use question_classified_response;
use question_state;
use qtype_drawlines\line;


defined('MOODLE_INTERNAL') || die();
global $CFG;

require_once($CFG->dirroot . '/question/engine/tests/helpers.php');
require_once($CFG->dirroot . '/question/type/drawlines/tests/helper.php');
require_once($CFG->dirroot . '/question/type/drawlines/question.php');


/**
 * Unit tests for draw lines question definition class.
 *
 * @package   qtype_drawlines
 * @copyright 2014 The Open University
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers \qtype_drawlines_question
 */
final class question_test extends \basic_testcase {

    public function test_get_expected_data(): void {
        $question = \test_question_maker::make_question('drawlines', 'mkmap_twolines');
        $question->start_attempt(new question_attempt_step(), 1);

        $expected = [
                'c0' => PARAM_RAW,
                'c1' => PARAM_RAW,
        ];
        $this->assertEquals($expected, $question->get_expected_data());
    }

    public function test_get_correct_response(): void {
        $question = \test_question_maker::make_question('drawlines', 'mkmap_twolines');
        $question->start_attempt(new question_attempt_step(), 1);
        $correctresponse = [
                'c0' => '10,10 300,10',
                'c1' => '10,200 300,200',
        ];
        $this->assertEquals($correctresponse, $question->get_correct_response());
    }

    public function test_is_complete_response(): void {
        $question = \test_question_maker::make_question('drawlines', 'mkmap_twolines');
        $question->start_attempt(new question_attempt_step(), 1);
        $correctresponse = $question->get_correct_response();
        $this->assertTrue($question->is_complete_response($correctresponse));
        $this->assertFalse($question->is_complete_response([]));
        $this->assertTrue($question->is_complete_response(
                [
                        'c0' => '10,10 200,10',
                        'c1' => '10,100 200,100',
                ]
        ));
        $this->assertFalse($question->is_complete_response(['c0' => '10,10 300,10']));
        $this->assertFalse($question->is_complete_response(['c1' => '10,100 300,100']));
        $this->assertTrue($question->is_complete_response(['c0' => '10,10 300,10', 'c1' => '10,100 300,100']));
    }

    public function test_is_gradable_response(): void {
        $question = \test_question_maker::make_question('drawlines', 'mkmap_twolines');
        $question->start_attempt(new question_attempt_step(), 1);
        $correctresponse = $question->get_correct_response();
        $this->assertTrue($question->is_gradable_response($correctresponse));
        $this->assertFalse($question->is_gradable_response([]));
        $this->assertTrue($question->is_gradable_response(['c0' => '10,10 300,10', 'c1' => '10,100 200,100']));
        if ($question->grademethod === 'partial') {
            $this->assertTrue($question->is_gradable_response(['c0' => '10,10 300,10']));
            $this->assertTrue($question->is_gradable_response(['c1' => '10,100 300,100']));
        }
        $question->grademethod = 'allnone';
        if ($question->grademethod === 'allnone') {
            $this->assertTrue($question->is_gradable_response(['c0' => '10,10 300,10']));
            $this->assertTrue($question->is_gradable_response(['c1' => '10,100 300,100']));
        }
    }

    public function test_is_same_response(): void {
        $question = \test_question_maker::make_question('drawlines', 'mkmap_twolines');
        $question->start_attempt(new question_attempt_step(), 1);

        $response = $question->get_correct_response();
        $expected = ['c0' => '10,10 300,10', 'c1' => '10,200 300,200'];
        $this->assertEquals($expected, $response);

        $this->assertTrue($question->is_same_response(
                ['c0' => '100,100 100,200', 'c1' => '200,100 200,200'],
                ['c0' => '100,100 100,200', 'c1' => '200,100 200,200']
        ));

        $this->assertFalse($question->is_same_response(
                ['c0' => '100,100 100,200', 'c1' => '200,100 200,200'],
                ['c0' => '10,100 100,200', 'c1' => '200,100 200,200']
        ));
    }

    public function test_get_question_summary(): void {
        $question = \test_question_maker::make_question('drawlines', 'mkmap_twolines');
        $summary = $question->get_question_summary();
        $this->assertNotEmpty($summary);

        $expected = 'Draw 2 lines on the map. A line segment from A (line starting point) to B (line Ending point), ' .
                'and another one from C to D. A is ..., B is ..., C is ... and D is ...';
        $this->assertEquals($expected, $summary);
    }

    public function test_summarise_response(): void {
        $question = \test_question_maker::make_question('drawlines', 'mkmap_twolines');
        $question->start_attempt(new question_attempt_step(), 1);

        // Correct responses with full mark for both Lines (mark = 1).
        $correctresponse = $question->get_correct_response();
        $expected = 'Line 1: 10,10 300,10, Line 2: 10,200 300,200';
        $actual = $question->summarise_response($correctresponse);
        $this->assertEquals($expected, $actual);

        // Partially correct responses with full marks for Line 1 and half of mark for Line 2 (mark = 0.75).
        $expected = 'Line 1: 10,10 300,10, Line 2: 10,200 300,123';
        $actual = $question->summarise_response(['c0' => '10,10 300,10', 'c1' => '10,200 300,123']);
        $this->assertEquals($expected, $actual);

        // Partially correct responses with full marks for Line 1 and no mark for Line 2 (mark = 0.5).
        $expected = 'Line 1: 10,10 300,10, Line 2: 10,123 300,123';
        $actual = $question->summarise_response(['c0' => '10,10 300,10', 'c1' => '10,123 300,123']);
        $this->assertEquals($expected, $actual);
    }

    public function test_get_num_parts_right_grade_partialt(): void {
        $question = \test_question_maker::make_question('drawlines');
        $question->start_attempt(new question_attempt_step(), 1);

        $correctresponse = $question->get_correct_response();
        [$numpartright, $total] = $question->get_num_parts_right_grade_partialt($correctresponse);
        $this->assertEquals(4, $numpartright);
        $this->assertEquals(4, $total);

        $response = ['c0' => '10,10 300,123', 'c1' => '10,123 300,123'];
        [$numpartright, $total] = $question->get_num_parts_right_grade_partialt($response);
        $this->assertEquals(1, $numpartright);
        $this->assertEquals(4, $total);

        $response = ['c0' => '10,10 300,10', 'c1' => '10,123 300,123'];
        [$numpartright, $total] = $question->get_num_parts_right_grade_partialt($response);
        $this->assertEquals(2, $numpartright);
        $this->assertEquals(4, $total);

        $response = ['c0' => '10,10 300,10', 'c1' => '10,200 300,123'];
        [$numpartright, $total] = $question->get_num_parts_right_grade_partialt($response);
        $this->assertEquals(3, $numpartright);
        $this->assertEquals(4, $total);
    }

    public function test_get_num_parts_right_grade_allornone(): void {
        $question = \test_question_maker::make_question('drawlines');
        $question->start_attempt(new question_attempt_step(), 1);

        $correctresponse = $question->get_correct_response();
        [$numright, $total] = $question->get_num_parts_right_grade_allornone($correctresponse);
        $this->assertEquals(2, $numright);
        $this->assertEquals(2, $total);

        $response = ['c0' => '10,10 300,123', 'c1' => '10,123 300,123'];
        [$numright, $total] = $question->get_num_parts_right_grade_allornone($response);
        $this->assertEquals(0, $numright);
        $this->assertEquals(2, $total);

        $response = ['c0' => '10,10 300,10', 'c1' => '10,123 300,123'];
        [$numright, $total] = $question->get_num_parts_right_grade_allornone($response);
        $this->assertEquals(1, $numright);
        $this->assertEquals(2, $total);

        $response = ['c0' => '10,10 300,10', 'c1' => '10,200 300,123'];
        [$numright, $total] = $question->get_num_parts_right_grade_allornone($response);
        $this->assertEquals(1, $numright);
        $this->assertEquals(2, $total);
    }

    public function test_compute_final_grade(): void {
        $question = \test_question_maker::make_question('drawlines');
        $question->start_attempt(new question_attempt_step(), 1);
        // TODO: To incorporate the question penalty for interactive with multiple tries behaviour.

        $totaltries = 1;

        $response = ['c0' => '100,10 300,100', 'c1' => '10,123 300,123'];
        $responses[] = $response;
        $fraction = $question->compute_final_grade($responses, $totaltries);
        $this->assertEquals($fraction, 0 / $totaltries, 'Incorrect responses should return fraction of 0');

        $responses = null;
        $response = ['c0' => '10,10 300,10', 'c1' => '10,123 300,123'];
        $responses[] = $response;
        $fraction = $question->compute_final_grade($responses, $totaltries);
        $this->assertEquals($fraction, 0.5 / $totaltries,
                'Partially correct responses(line 1 is correct and line 2 is incorrect) should return fraction of 0.5');

        $responses = null;
        $response = ['c0' => '10,10 300,10', 'c1' => '10,200 300,123'];
        $responses[] = $response;
        $fraction = $question->compute_final_grade($responses, $totaltries);
        $this->assertEquals($fraction, 0.75 / $totaltries,
                'Partially correct responses(line 1 is correct and line 2 is half-correct) should return fraction of 0.75');

        $responses = null;
        $correctresponse = $question->get_correct_response();
        $responses[] = $correctresponse;
        $fraction = $question->compute_final_grade($responses, $totaltries);
        $this->assertEquals($fraction, 1 / $totaltries, 'All correct responses should return fraction of 1');
    }
}
