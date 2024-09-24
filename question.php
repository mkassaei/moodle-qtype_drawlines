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

use qtype_drawlines\line;

/**
 * Draw lines question definition class.
 *
 * @package    qtype_drawlines
 * @copyright  2024 The Open University
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
#[AllowDynamicProperties]
//class qtype_drawlines_question extends question_graded_automatically_with_countback
//        implements question_automatically_gradable_with_countback {
class qtype_drawlines_question extends question_graded_automatically {

    /** @var lines[], an array of line objects. */
    public $lines;

    /** @var int The number of lines. */
    public $numberoflines;

    /** @var dragableitems[], array of draggable items (list of start and end of lines). */
    public $dragableitems;

    /**
     * @var array of arrays. The outer keys are the choice group numbers.
     * The inner keys for most question types number sequentialy from 1. However
     * for ddimageortext questions it is strange (and difficult to change now).
     * the first item in each group gets numbered 1, and the other items get numbered
     * $choice->no. Be careful!
     * The values are arrays of qtype_gapselect_choice objects (or a subclass).
     */
    public $choices;

    /**
     * @var array place number => group number of the places in the question
     * text where choices can be put. Places are numbered from 1.
     */
    public $places;

    #[\Override]
    public function compute_final_grade($responses, $totaltries)
    {
        $grade_value = 0;
        foreach($responses as $response) {
            $x = $this->grade_response($response);
            $grade_value += $x[0];
        }
        return $grade_value;
    }

    /**
     * Get a choice identifier
     *
     * @param int $choice stem number
     * @return string the question-type variable name.
     */
    public function choice($choice) {
        return 'c' . $choice;
    }

    #[\Override]
    public function check_file_access($qa, $options, $component, $filearea, $args, $forcedownload) {
        if ($filearea === 'bgimage') {
            $validfilearea = true;
        } else {
            $validfilearea = false;
        }
        if ($component === 'qtype_drawlines' && $validfilearea) {
            $question = $qa->get_question(false);
            $itemid = reset($args);
            return $itemid == $question->id;
        } else {
            return parent::check_file_access($qa, $options, $component, $filearea, $args, $forcedownload);
        }
    }
    #[\Override]
    public function get_expected_data() {
        $expecteddata =[];
        foreach ($this->lines as $line) {
            $expecteddata[$this->choice($line->number - 1)] = PARAM_NOTAGS;
        }
        return $expecteddata;
    }

    //public function get_right_choice_for($placeno) {
    //    $place = $this->places[$placeno];
    //    foreach ($this->choiceorder[$place->group] as $choicekey => $choiceid) {
    //        if ($this->rightchoices[$placeno] == $choiceid) {
    //            return $choicekey;
    //        }
    //    }
    //}
    //

    #[\Override]
    public function is_complete_response(array $response): bool {
        foreach ($this->lines as $key => $line) {
            if (isset($response[$this->choice($key)])) {
                return true;
            }
        }
        return false;
    }

    #[\Override]
    public function is_gradable_response(array $response) {
        return $this->is_complete_response($response);
    }

    #[\Override]
    public function is_same_response(array $prevresponse, array $newresponse) {
        foreach ($this->lines as $line) {
            if (array_key_exists($this->choice($line->number), $prevresponse) &&
                    array_key_exists($this->choice($line->number + 1), $newresponse)) {

                // Return false if the responses are not the same.
                if ($prevresponse[$this->choice($line->number)] !==
                        $newresponse[$this->choice($line->number)]) {
                    return false;
                }
                if ($prevresponse[$this->choice($line->number + 1)] !==
                        $newresponse[$this->choice($line->number + 1)]) {
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * Tests to see whether two arrays have the same set of coords at a particular key. Coords
     * can be in any order.
     *
     * @param array $array1 the first array.
     * @param array $array2 the second array.
     * @param string $key an array key.
     * @return bool whether the two arrays have the same set of coords (or lack of them)
     * for a given key.
     */
    public function arrays_same_at_key_integer(array $array1, array $array2, $key) {
        if (array_key_exists($key, $array1)) {
            $value1 = $array1[$key];
        } else {
            $value1 = '';
        }
        if (array_key_exists($key, $array2)) {
            $value2 = $array2[$key];
        } else {
            $value2 = '';
        }
        $coords1 = explode(';', $value1);
        $coords2 = explode(';', $value2);
        if (count($coords1) !== count($coords2)) {
            return false;
        } else {
            if (count($coords1) === 0) {
                return true;
            } else {
                $valuesinbotharrays = $this->array_intersect_fixed($coords1, $coords2);
                return (count($valuesinbotharrays) == count($coords1));
            }
        }
    }

    /**
     *
     * This function is a variation of array_intersect that checks for the existence of duplicate
     * array values too.
     *
     * @param array $array1
     * @param array $array2
     * @return bool whether array1 and array2 contain the same values including duplicate values
     * @author dml at nm dot ru (taken from comments on php manual)
     */
    protected function array_intersect_fixed($array1, $array2) {
        $result = array();
        foreach ($array1 as $val) {
            if (($key = array_search($val, $array2, true)) !== false) {
                $result[] = $val;
                unset($array2[$key]);
            }
        }
        return $result;
    }

    #[\Override]
    public function get_validation_error(array $response): string {
        if ($this->is_complete_response($response)) {
            return '';
        }
        return get_string('pleasedragalllines', 'qtype_drawlines');
    }

    #[\Override]
    public function get_num_parts_right(array $response) {
        $numpartright = 0;
        foreach($this->lines as $key => $line) {
            if (array_key_exists($this->choice($key), $response) && $response[$this->choice($key)] !== '') {
                $coords = explode(' ', $response[$this->choice($key)]);
                if (line::is_dragitem_in_the_right_place($coords[0], $line->zonestart)) {
                    $numpartright++;
                }
                if (line::is_dragitem_in_the_right_place($coords[1], $line->zoneend)) {
                    $numpartright++;
                }
            }
        }
        $total = count($this->lines) * 2;
        return [$numpartright, $total];
    }

    public function xxxget_num_parts_right(array $response) {
        $numright = 0;
        foreach ($this->stemorder as $key => $stemid) {
            $fieldname = $this->field($key);
            if (!array_key_exists($fieldname, $response)) {
                continue;
            }

            $choice = $response[$fieldname];
            if ($choice && $this->choiceorder[$choice] == $this->right[$stemid]) {
                $numright += 1;
            }
        }
        return array($numright, count($this->stemorder));
    }


    #[\Override]
    public function grade_response(array $response) {
        [$right, $total] = $this->get_num_parts_right($response);
        $fraction = $right / $total;
        return [$fraction, question_state::graded_state_for_fraction($fraction)];
    }



    #[\Override]
    public function classify_response(array $response) {
        //print_object($response);
        //print_object('classify_response ----------------');
        $parts = [];
        //$hits = $this->choose_hits($response);
        foreach ($this->places as $placeno => $place) {
            if (isset($hits[$placeno])) {
                $shuffledchoiceno = $this->get_right_choice_for($placeno);
                $choice = $this->get_selected_choice(1, $shuffledchoiceno);
                $parts[$placeno] = new question_classified_response(
                        $choice->no,
                        $choice->summarise(),
                        1 / count($this->places));
            } else {
                $parts[$placeno] = question_classified_response::no_response();
            }
        }
        return $parts;
    }

    /**
     * @param $place
     * @return int|string|null
     */
    public function get_right_choice_for($place) {
        foreach ($this->choices as $choicekey => $choiceid) {
            // Compare the numbers only  by extracting the numbet from choicekey.
            if ($place == (int)filter_var($choicekey, FILTER_SANITIZE_NUMBER_INT)) {
                return $choicekey;
            }
        }
        return null;
    }

    #[\Override]
    public function get_correct_response() {
        $response = [];
        foreach ($this->lines as $key => $line) {
            $response[$this->choice($key)] = line::get_coordinates($line->zonestart) . ' '
                    . line::get_coordinates($line->zoneend);
        }
        return $response;
    }

    #[\Override]
    public function summarise_response(array $response): ?string {
        $responsewords = [];
        $answers = [];
        foreach ($this->lines as $key => $line) {
            if (array_key_exists($this->choice($key), $response) && $response[$this->choice($key)] != '') {
                $answers[] = 'Line ' . $line->number . ': ' . $response[$this->choice($key)];
            }
        }
        if (count($answers) > 0) {
            $responsewords[] = implode(', ', $answers);
        }
        return implode('; ', $responsewords);
    }

    /**
     * Return the coordinates from the response.
     * @param string $responsechoice the response coordinates.
     * @return array $coordinates The array of parsed coordinates.
     */
    public function parse_coordinates(string $responsechoice): array {
        $coordinates = [];
        $bits = explode(';', $responsechoice);
        $coordinates['coords'] = $bits[0];
        $coordinates['inplace'] = $bits[1];
        return $coordinates;
    }

    #[\Override]
    public function get_random_guess_score() {
        return null;
    }

    /**
     * Choose hits to maximize grade where drop targets may have more than one hit and drop targets
     * can overlap.
     *
     * @param array $response
     * @return array chosen hits
     */
    //protected function choose_hits(array $response) {
    //    $allhits = $this->get_all_hits($response);
    //    $chosenhits = array();
    //    foreach ($allhits as $placeno => $hits) {
    //        foreach ($hits as $itemno => $hit) {
    //            $choice = $this->get_right_choice_for($placeno);
    //            $choiceitem = "$choice $itemno";
    //            if (!in_array($choiceitem, $chosenhits)) {
    //                $chosenhits[$placeno] = $choiceitem;
    //                break;
    //            }
    //        }
    //    }
    //    return $chosenhits;
    //}

    //public function get_drop_zones_without_hit(array $response) {
    //    $hits = $this->choose_hits($response);
    //
    //    $nohits = array();
    //    foreach ($this->places as $placeno => $place) {
    //        $choice = $this->get_right_choice_for($placeno);
    //        if (!isset($hits[$placeno])) {
    //            $nohit = new stdClass();
    //            $nohit->coords = $place->coords;
    //            $nohit->shape = $place->shape->name();
    //            $nohit->markertext = $this->choices[1][$this->choiceorder[1][$choice]]->text;
    //            $nohits[] = $nohit;
    //        }
    //    }
    //    return $nohits;
    //}

    //protected function are_coords_in_correct_zone(int $questionid, int $linenumber, string $currentcoords, string $expectedcoords) {
    //
    //    return true;
    //}
}
